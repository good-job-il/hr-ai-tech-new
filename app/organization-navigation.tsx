'use client';

import {useEffect,useState} from 'react';
import UiIcon from './ui-icon';
import './organization-workspace-design.css';

const dailyIcons:Record<string,string>={
  'org-work':'home', 'org-candidates':'team', 'org-jobs':'jobs',
  'org-interviews':'calendar', 'org-clients':'employers', 'org-reports':'chart',
};
const managementIcons:Record<string,string>={
  'org-partnerships':'share', 'org-team':'admin', 'org-rewards':'chart',
  'org-company':'employers', 'org-billing':'jobs', 'org-connections':'settings',
};

export default function OrganizationNavigation({name,items,active,lang,onNavigate}:{
  name:string;items:string[][];active:string;lang:'he'|'en';onNavigate:(key:string)=>void;
}) {
  const he=lang==='he';
  const [mobileOpen,setMobileOpen]=useState(false),[managementOpen,setManagementOpen]=useState(Boolean(managementIcons[active]));
  useEffect(()=>{if(managementIcons[active])setManagementOpen(true);},[active]);
  const management=items.filter(([key])=>Boolean(managementIcons[key]));
  const renderItem=([key,,label]:string[])=>
    <button key={key} type="button" className={active===key?'active':''} aria-current={active===key?'page':undefined}
      onClick={()=>{setMobileOpen(false);onNavigate(key);}}>
      <UiIcon name={dailyIcons[key]??managementIcons[key]??'jobs'} size={24}/>{label}
    </button>;
  return <>
    <div className="organizationSidebarIdentity"><strong dir="auto">{name}</strong>
      <button className="organizationMobileMenu" type="button" aria-expanded={mobileOpen} aria-controls="organization-sidebar-nav" onClick={()=>setMobileOpen(!mobileOpen)}>
        <UiIcon name="menu" size={22}/>{he?'תפריט':'Menu'}
      </button>
    </div>
    <nav id="organization-sidebar-nav" className="organizationSidebarNav" data-mobile-open={mobileOpen} aria-label={he?'ניווט סביבת העבודה':'Workspace navigation'}>
      {items.filter(([key])=>Boolean(dailyIcons[key])).map(renderItem)}
      {management.length>0&&<div className="organizationSidebarManagement">
        <button type="button" className="organizationManagementToggle" aria-expanded={managementOpen} aria-controls="organization-management-links" onClick={()=>setManagementOpen(!managementOpen)}>
          <UiIcon name="settings" size={22}/>{he?'ניהול הארגון':'Organization management'}<UiIcon name="chevron-down" size={18}/>
        </button>
        <div id="organization-management-links" hidden={!managementOpen}>{management.map(renderItem)}</div>
      </div>}
      {items.filter(([key])=>!dailyIcons[key]&&!managementIcons[key]).map(renderItem)}
    </nav>
  </>;
}
