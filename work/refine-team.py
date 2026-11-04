from pathlib import Path
p=Path('app/team.tsx');s=p.read_text(encoding='utf-8');s=s.replace("[closing,C]=useState<Member|null>(null)","[closing,C]=useState<Member|null>(null),[showInactive,SI]=useState(false)")
s=s.replace('{members.map(m=>',"<div className=\"orgTeamSummary\"><span>{members.filter(m=>m.status==='active').length} {tr('חברי צוות פעילים','active team members')}</span>{members.some(m=>m.status!=='active')&&<button aria-pressed={showInactive} onClick={()=>SI(!showInactive)}>{showInactive?tr('הסתרת חשבונות ללא גישה','Hide inactive accounts'):tr('הצגת חשבונות ללא גישה','Show inactive accounts')}</button>}</div>{members.filter(m=>showInactive||m.status==='active').map(m=>")
p.write_text(s,encoding='utf-8')
p=Path('app/organization-management.tsx');s=p.read_text(encoding='utf-8');s=s.replace("(cap.can('team.configure')?<Team", "(cap.loading?<p role=\"status\">{t('טוען הרשאות…','Loading permissions…')}</p>:cap.can('team.configure')?<Team")
p.write_text(s,encoding='utf-8')
