import Image from 'next/image';

export default function BrandIcon({className='brandImage',alt='',size=44}:{className?:string;alt?:string;size?:number}) {
 return <Image src="/brand-hr-v1.png" width={size} height={size} sizes={`${size}px`} className={className} alt={alt} loading="eager"/>;
}
