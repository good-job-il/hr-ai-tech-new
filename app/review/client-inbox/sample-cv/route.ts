export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.CLIENT_PORTAL_REVIEW!=='1'||process.env.VERCEL)return new Response(null,{status:404});
 // This document is synthetic and contains no candidate data or storage credentials.
 const stream='BT /F1 23 Tf 48 760 Td (DEMONSTRATION CV) Tj /F1 12 Tf 0 -32 Td (Synthetic profile - not a real person) Tj 0 -58 Td (PROFESSIONAL SUMMARY) Tj 0 -25 Td (Team leadership, customer service and daily operations.) Tj 0 -48 Td (EXPERIENCE) Tj 0 -25 Td (Department manager - demonstration role) Tj 0 -23 Td (Coordinating teams and supporting customer service.) Tj 0 -48 Td (SKILLS) Tj 0 -25 Td (Teamwork / Operations / Service / Inventory management) Tj 0 -80 Td (Preview only. No real employment or personal information.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets:number[]=[];for(const [i,obj]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`}const start=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return new Response(pdf,{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store','Content-Disposition':'inline; filename="demonstration-cv.pdf"'}});
}
