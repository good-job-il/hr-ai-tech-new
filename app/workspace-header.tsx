'use client';
import type {ReactNode} from 'react';
import UiIcon from './ui-icon';

export default function WorkspaceHeader({title,scope,icon='dashboard',identity,cardTitle,children}:{title:ReactNode;scope:ReactNode;icon?:string;identity?:ReactNode;cardTitle?:string;children:ReactNode}){
 return <header className="workspaceTopbar"><div className="workspaceTopbarHeading"><span className="workspaceTopbarIcon" aria-hidden="true"><UiIcon name={icon} size={21}/></span><div className="workspaceTopbarTitles"><div className="workspaceTopbarScope">{scope}</div><div className="workspaceTopbarTitle">{title}</div></div></div>{cardTitle&&<nav className="candidateCardBreadcrumb" aria-label={cardTitle}><strong>{title}</strong><span aria-hidden="true">/</span><span aria-current="page">{cardTitle}</span></nav>}<div className="workspaceTopbarActions">{identity}<div className="workspaceTopbarUtilities">{children}</div></div></header>;
}
