'use client';

import dynamic from 'next/dynamic';
import type { PublicInfo } from './ServiceForm';

const ServiceForm = dynamic(() => import('./ServiceForm'), { ssr: false });

export default function ServiceFormLoader({ info }: { info: PublicInfo }) {
  return <ServiceForm info={info} />;
}
