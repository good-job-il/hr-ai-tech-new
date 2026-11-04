'use client';
import type {ReactNode} from 'react';
import UiIcon from './ui-icon';

export default function WorkspaceHeader({title,scope,icon='dashboard',identity,children}:{title:ReactNode;scope:ReactNode;icon?:string;identity?:ReactNode;children:ReactNode}){
 return <header className="workspaceTopbar"><div className="workspaceTopbarHeading"><span className="workspaceTopbarIcon" aria-hidden="true"><UiIcon name={icon} size={21}/></span><div className="workspaceTopbarTitles"><div className="workspaceTopbarScope">{scope}</div><div className="workspaceTopbarTitle">{title}</div></div></div><div className="workspaceTopbarActions">{identity}<div className="workspaceTopbarUtilities">{children}</div></div></header>;
}
