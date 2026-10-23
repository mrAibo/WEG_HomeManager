// Synthetic-only browser regression: quick file filing persists across navigation,
// homeowner suggestion goes to manager review, human adds agenda item.
// No external AI, mail, payment, real property or actual PDF data.
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const prisma = new PrismaClient();
const base = "http://127.0.0.1:3000";
const core = JSON.parse(fs.readFileSync(path.resolve("..","WEG_HomeManager_LOCAL_TEST_CREDENTIALS.json"),"utf8"));
const portal = JSON.parse(fs.readFileSync(path.resolve("..","WEG_HomeManager_LOCAL_PORTAL_TEST_CREDENTIALS.json"),"utf8"));
const newTitle = "E9 Chrome-Test - synthetische Fahrradstellplatz-Anregung";
let caseId=null,suggestionId=null,agendaId=null,storedKey=null,browser;
function insist(v,s){if(!v)throw Error("E9_BROWSER_ASSERT: "+s)}
async function login(p,creds){
 await p.goto(base+"/de/login");
 await p.locator("#email").fill(creds.email);
 await p.locator("#password").fill(creds.password);
 await p.locator("form button[type=submit]").click();
 await p.waitForURL(u=>!u.pathname.endsWith("/login"),{timeout:15000});
}
async function main(){
 try {
 const db=new URL(process.env.DATABASE_URL??"");
 insist(["localhost","127.0.0.1"].includes(db.hostname)&&db.port==="5432"&&db.pathname==="/havewa","synthetic-only DB");
 const tenants=await prisma.tenant.findMany({select:{id:true,name:true}});
 insist(tenants.length===1&&tenants[0].name==="WEG Demo – Sechs Wohnungen","expected DEMO tenant");
 const users=await prisma.user.findMany({select:{email:true}});
 insist(users.every(u=>u.email.endsWith(".invalid")),"no real users");
 const fixture=await prisma.property.findFirst({where:{tenantId:tenants[0].id,
   name:"WEG Musterhaus – sechs Wohnungen [SYNTHETISCH]"},select:{id:true}});
 insist(fixture,"missing E9 seed");
 const meeting=await prisma.meeting.findFirst({where:{tenantId:tenants[0].id,propertyId:fixture.id,
   status:"GEPLANT"},select:{id:true}});
 insist(meeting,"meeting required");

 browser=await chromium.launch({channel:"chrome",headless:true});
 const adminContext=await browser.newContext({viewport:{width:1280,height:840}});
 const admin=await adminContext.newPage();
 await login(admin,core);
 await admin.goto(base+"/de/dashboard");
 await admin.getByRole("heading",{name:/Was möchten Sie heute erledigen/}).waitFor();
 // An actual generated PDF, never an uploaded property document.
 const pdf=await PDFDocument.create();
 pdf.addPage([295,420]);
 const bytes=Buffer.from(await pdf.save());
 await admin.locator('input[aria-label="Dokument für das Anliegen auswählen"]')
    .setInputFiles({name:"E9-Synthetisches-Dokument.pdf",mimeType:"application/pdf",buffer:bytes});
 await admin.getByRole("button",{name:"Dokument jetzt ablegen"}).click();
 const saved=admin.getByRole("link",{name:/Gespeichertes Dokument öffnen/});
 await saved.waitFor({timeout:30000});
 const href=await saved.getAttribute("href");
 insist(href?.includes("/cases/"),"durable Case link missing");
 caseId=href.split("/cases/")[1].split(/[?#/]/)[0];
 insist(caseId,"missing case ID");
 const stored=await prisma.aiEvidence.findFirst({where:{tenantId:tenants[0].id,caseId},
   select:{storageKey:true,name:true}});
 insist(stored?.name==="E9-Synthetisches-Dokument.pdf","Evidence not stored");
 storedKey=stored.storageKey;
 await admin.goto(base+"/de/meetings");
 await admin.goto(base+"/de/cases");
 await admin.getByText(/E9-Synthetisches-Dokument\.pdf/).first().waitFor();
 await admin.goto(base+"/de/cases/"+caseId);
 await admin.getByText(/E9-Synthetisches-Dokument\.pdf/).first().waitFor();
 console.log("E9_FILE_PERSISTENCE_PASS: quick PDF save, navigate elsewhere and back, Evidence survives");

 const ownerContext=await browser.newContext({viewport:{width:1050,height:800}});
 const owner=await ownerContext.newPage();
 await login(owner,portal.owner);
 await owner.goto(base+"/de/portal");
 await owner.getByText("Vorschlag oder Bitte für die nächste Versammlung").waitFor();
 await owner.locator('select[name="meetingId"]').selectOption(meeting.id);
 await owner.locator('input[name="title"]').fill(newTitle);
 await owner.locator('textarea[name="description"]')
   .fill("Nur synthetischer Test: bitte Fahrradstellplätze für die Muster-WEG besprechen.");
 await owner.getByRole("button",{name:"Anregung zur Prüfung einreichen"}).click();
 await owner.waitForURL(/anregung=eingereicht/,{timeout:15000});
 const row=await prisma.meetingSuggestion.findFirst({where:{tenantId:tenants[0].id,
  meetingId:meeting.id,title:newTitle},select:{id:true,status:true}});
 insist(row?.status==="NEW","owner suggestion must enter pending review");
 suggestionId=row.id;
 await admin.goto(base+"/de/meetings/"+meeting.id);
 await admin.getByText(newTitle).first().waitFor();
 const card=admin.locator("div.rounded-xl.border.bg-background").filter({hasText:newTitle}).first();
 await card.getByRole("button",{name:"Als TOP übernehmen"}).click();
 let checked;
 for(let i=0;i<40;i++){
   checked=await prisma.meetingSuggestion.findUniqueOrThrow({where:{id:suggestionId}});
   if(checked.status==="ADDED"&&checked.agendaItemId)break;
   await new Promise(r=>setTimeout(r,250));
 }
 insist(checked.status==="ADDED"&&checked.agendaItemId,"manager did not approve into agenda");
 // Revisit the canonical server-rendered page; Next Server Action navigation
 // may revalidate asynchronously on this Windows build.
 await admin.goto(base+"/de/meetings/"+meeting.id);
 await admin.getByText(/In Tagesordnung/).first().waitFor({timeout:10000});
 agendaId=checked.agendaItemId;
 console.log("E9_SUGGESTION_REVIEW_PASS: authenticated owner submitted, manager reviewed and added a TOP");
} finally {
 await browser?.close();
 if(suggestionId){
   const linked = await prisma.meetingSuggestion.findUnique({where:{id:suggestionId},select:{agendaItemId:true}});
   await prisma.meetingSuggestion.deleteMany({where:{id:suggestionId}});
   const possibleAgendaId=agendaId??linked?.agendaItemId;
   if(possibleAgendaId)await prisma.agendaItem.deleteMany({where:{id:possibleAgendaId}});
 }
 if(caseId){
   await prisma.$transaction(async tx=>{
     await tx.aiRecognition.deleteMany({where:{caseId}});
     await tx.aiCaseEvent.deleteMany({where:{caseId}});
     await tx.aiEvidence.deleteMany({where:{caseId}});
     await tx.aiProposal.deleteMany({where:{caseId}});
     await tx.aiCase.deleteMany({where:{id:caseId}});
   });
   if(storedKey){
     const target=path.resolve("storage/documents",storedKey);
     if(target.startsWith(path.resolve("storage/documents")+path.sep)){
       fs.rmSync(target,{force:true});
     }
   }
 }
 await prisma.$disconnect();
}
}
main().catch(e=>{console.error("E9_CHROME_FAIL",e.message);process.exitCode=1});
