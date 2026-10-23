/**
 * Idempotent E9 synthetic-only WEG demo scenario. NEVER run on production.
 * Must be explicitly invoked; npm ci/migrate/build NEVER auto-seed.
 */
import { prisma } from "../src/lib/prisma";
import { createLocalCase } from "../src/server/ai-case-workflow";
import { addCaseEvidence } from "../src/server/ai-evidence-workflow";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEMO = "WEG Musterhaus – sechs Wohnungen [SYNTHETISCH]";
const OWNER_EMAIL = "qa-owner@weg-home-manager.invalid";
const TENANT_EMAIL = "qa-bewohner@weg-home-manager.invalid";

function guard(ok: unknown, msg: string): asserts ok { if (!ok) throw Error("E9_SEED_DENIED: " + msg); }
async function pdf(label: string, lines: string[]): Promise<Buffer> {
  const d = await PDFDocument.create();
  const page = d.addPage([595,842]);
  const font = await d.embedFont(StandardFonts.Helvetica);
  page.drawText("SYNTHETISCH / NUR DEMO - KEIN ECHTES DOKUMENT", {
    x: 50,y:785,size:15,font,color:rgb(0.05,0.38,0.39)
  });
  page.drawText(label,{x:50,y:743,size:19,font});
  lines.forEach((line,i)=>page.drawText(line,{x:50,y:692-i*29,size:12,font}));
  return Buffer.from(await d.save());
}
async function main() {
  const uri=new URL(process.env.DATABASE_URL??"");
  guard(["127.0.0.1","localhost"].includes(uri.hostname)
    && uri.port==="5432" && uri.pathname==="/havewa","local-only synthetic DB");
  const tenants=await prisma.tenant.findMany({select:{id:true,name:true}});
  const users=await prisma.user.findMany({select:{id:true,tenantId:true,email:true,role:true}});
  guard(tenants.length===1 && tenants[0].name==="WEG Demo – Sechs Wohnungen","demo tenant required");
  guard(users.length>0 && users.every(u=>u.email.endsWith(".invalid")),"non-synthetic user found");
  const admin=users.find(u=>u.role==="ADMIN" && u.tenantId===tenants[0].id);
  guard(admin,"demo admin required");
  const tenantId=tenants[0].id;
  const duplicate=await prisma.property.findFirst({where:{tenantId,name:DEMO},select:{id:true}});
  if(duplicate) {
    console.log("E9_DEMO_ALREADY_PRESENT: synthetic scenario exists; did not duplicate");
    return;
  }
  // Credentials are placed ONLY in a local file OUTSIDE Git's repository.
  const ownerPass=crypto.randomBytes(18).toString("base64url");
  const residentPass=crypto.randomBytes(18).toString("base64url");
  const bcryptHashes=await Promise.all([bcrypt.hash(ownerPass,12),bcrypt.hash(residentPass,12)]);
  const made=await prisma.$transaction(async tx=>{
    const property=await tx.property.create({data:{
      tenantId,name:DEMO,street:"Beispielweg 7 (fiktiv)",zip:"00000",city:"Musterstadt",
      management:"WEG",type:"WOHNEN",meaTotal:1000,
    }});
    const building=await tx.building.create({data:{
      tenantId,propertyId:property.id,name:"Beispielhaus A (synthetisch)"
    }});
    const parts=[150,170,160,180,160,180];
    const units=[];
    for(let i=0;i<6;i++){
      units.push(await tx.unit.create({data:{
        tenantId,buildingId:building.id,label:`Wohnung ${i+1}`,
        type:"WOHNUNG",area:65+i*3,rooms:3,mea:parts[i]
      }}));
    }
    const person=await tx.person.create({data:{
      tenantId,firstName:"Demo",lastName:"Eigentuemerin",
      email:OWNER_EMAIL,type:"EIGENTUEMER"
    }});
    await tx.owner.create({data:{tenantId,unitId:units[0].id,personId:person.id,share:1000}});
    const owner=await tx.user.create({data:{
      tenantId,email:OWNER_EMAIL,name:"Demo Eigentümerin",
      passwordHash:bcryptHashes[0],role:"EIGENTUEMER",personId:person.id
    }});
    const residentPerson=await tx.person.create({data:{
      tenantId,firstName:"Demo",lastName:"Bewohner",
      email:TENANT_EMAIL,type:"MIETER"
    }});
    const lease=await tx.lease.create({data:{
      tenantId,unitId:units[1].id,startDate:new Date("2026-01-01T00:00:00Z"),
      rentCold:640,personCount:1
    }});
    await tx.renter.create({data:{tenantId,personId:residentPerson.id,leaseId:lease.id}});
    const resident=await tx.user.create({data:{
      tenantId,email:TENANT_EMAIL,name:"Demo Bewohner",
      passwordHash:bcryptHashes[1],role:"MIETER",personId:residentPerson.id
    }});
    const meeting=await tx.meeting.create({data:{
      tenantId,propertyId:property.id,
      title:"Beispiel-Eigentümerversammlung 2026 [DEMO]",
      date:new Date("2026-11-19T17:00:00Z"),location:"Gemeinschaftsraum (fiktiv)",
      status:"GEPLANT"
    }});
    const agenda=[
      ["Begrüßung und Feststellung der Beschlussfähigkeit","Teilnehmer, Vollmachten und anwesende MEA prüfen"],
      ["Wirtschaftsplan 2027 - Entwurf","Nur synthetische Zahlen; vor einer echten Beschlussvorlage fachlich prüfen"],
      ["Erhaltungsrücklage / Maßnahmenplanung","Wartung und notwendige Reparaturen sammeln"],
    ];
    let n=0;
    for(const [title,description] of agenda){
      await tx.agendaItem.create({data:{tenantId,meetingId:meeting.id,position:++n,title,description}});
    }
    await tx.meetingSuggestion.create({data:{
      tenantId,meetingId:meeting.id,submittedById:owner.id,submittedRole:"EIGENTUEMER",
      title:"Beleuchtung im Treppenhaus verbessern",
      description:"Bitte Möglichkeiten für LED-Beleuchtung und Bewegungssensoren prüfen. (Nur Testdaten)"
    }});
    await tx.meetingSuggestion.create({data:{
      tenantId,meetingId:meeting.id,submittedById:resident.id,submittedRole:"MIETER",
      title:"Fahrradstellplätze ordnen",
      description:"Bitte mehr Platz und Kennzeichnung für Fahrradstellplätze prüfen. (Nur Testdaten)"
    }});
    return {propertyId:property.id,meetingId:meeting.id,ownerId:owner.id,residentId:resident.id};
  });
  const credsPath=path.resolve("..","WEG_HomeManager_LOCAL_PORTAL_TEST_CREDENTIALS.json");
  fs.writeFileSync(credsPath,JSON.stringify({
    owner:{email:OWNER_EMAIL,password:ownerPass},
    resident:{email:TENANT_EMAIL,password:residentPass}
  },null,2)+"\n",{flag:"wx"});
  const actor={id:admin.id,tenantId,role:"ADMIN" as const};
  for(const doc of [
    {
      name:"DEMO_Einladung_Entwurf_2026.pdf",
      desc:"Synthetischer Einladungsentwurf für die Test-Eigentümerversammlung 2026.",
      lines:["Beispiel-Eigentuemerversammlung am 19.11.2026 um 18 Uhr",
        "Ort: Gemeinschaftsraum (fiktiv)","Dies ist kein rechtsgueltiges Einladungsschreiben."]
    },
    {
      name:"DEMO_Wirtschaftsplan_2027.pdf",
      desc:"Synthetischer Wirtschaftsplan 2027 zur gemeinsamen Prüfung.",
      lines:["Geschaetzte Kosten 2027: 24.000 EUR (rein fiktiv)",
        "Sechs Wohnungen, 1000/1000 Miteigentumsanteile",
        "Entwurf - keine Buchungs- oder Zahlungsfreigabe."]
    }
  ]){
    const stored=await createLocalCase(actor,{
      kind:"DOCUMENT",summary:doc.desc,sourceText:doc.desc,
      title:doc.name,body:doc.desc+"\nVor Versendung oder Beschluss bitte pruefen.",
    });
    await prisma.aiCase.update({where:{id:stored.caseId},data:{propertyId:made.propertyId}});
    await addCaseEvidence(actor,stored.caseId,doc.name,await pdf(doc.name,doc.lines));
  }
  console.log("E9_SYNTHETIC_DEMO_CREATED: 1 WEG, 6 units, 1 owner, 1 resident, 1 planned meeting, 3 agenda items, 2 proposals, 2 generated PDFs");
  console.log("Portal test credentials remain outside Git: "+path.basename(credsPath));
  console.log("No payment, Gmail, real WEG file, other tenant or external system changed.");
}
main().catch(e=>{console.error("E9_SEED_FAIL:",e.message);process.exitCode=1})
  .finally(()=>prisma.$disconnect());
