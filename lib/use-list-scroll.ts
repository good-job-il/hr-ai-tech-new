'use client';
import {useLayoutEffect,useRef} from 'react';
import type {ListScroll} from './recruitment-context';

export function useListScroll<T extends HTMLElement=HTMLDivElement>(memory:ListScroll,visible:boolean,axis:'x'|'y') {
  const box=useRef<T>(null);
  useLayoutEffect(()=>{
    if(!visible)return;
    const node=box.current;
    window.scrollTo(0,memory.page);
    if(node){if(axis==='x')node.scrollLeft=memory.box;else node.scrollTop=memory.box;}
    const onPage=()=>{memory.page=window.scrollY;};
    const onBox=()=>{if(node)memory.box=axis==='x'?node.scrollLeft:node.scrollTop;};
    window.addEventListener('scroll',onPage,{passive:true});
    node?.addEventListener('scroll',onBox,{passive:true});
    return ()=>{window.removeEventListener('scroll',onPage);node?.removeEventListener('scroll',onBox);};
  },[memory,visible,axis]);
  return box;
}
