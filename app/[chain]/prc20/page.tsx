'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function PRC20RedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const chainName = params.chain as string;
    // Redirect to swap page
    router.replace(`/${chainName}/prc20/swap`);
  }, [params, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Redirecting to swap...</div>
    </div>
  );
}
