'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { readCv, type CvRead } from '../lib/cv-client';
const PdfDocumentViewer = dynamic(() => import('./pdf-document-viewer'), { ssr: false });

export default function CvDocumentViewer({ source, label, lang }: { source: CvRead; label: string; lang: 'he' | 'en' }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const key = JSON.stringify(source);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setError(false);
    void readCv(JSON.parse(key)).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key]);
  if (error) return <p role="alert">{lang === 'he' ? 'אין הרשאה למסמך או שהגישה בוטלה.' : 'Document unavailable or access revoked.'}</p>;
  if (!url) return <p role="status">{lang === 'he' ? 'טוען מסמך...' : 'Loading document...'}</p>;
  return <PdfDocumentViewer url={url} label={label} lang={lang} />;
}
