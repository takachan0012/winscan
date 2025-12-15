// Ads Configuration
// This file manages all advertising configuration for WinScan

export interface AdConfig {
  id: string;
  title: string;
  description: string;
  image?: string;
  link: string;
  cta?: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface SponsoredValidatorConfig {
  validatorAddress: string;
  chainId: string;
  startDate: string;
  endDate: string;
  priority: number; // Higher number = shown first
  active: boolean;
}

// Banner Ads Configuration
export const bannerAds: Record<string, AdConfig[]> = {
  top: [
    {
      id: 'top-winscan-promo',
      title: 'Explore 30+ Cosmos Chains',
      description: 'Track validators, governance, and transactions across the Cosmos ecosystem & For Banner Ads @winscan Team',
      link: '/',
      cta: 'Explore Chains',
      active: true,
    },
  ],
  
  sidebar: [
    {
      id: 'sidebar-stake',
      title: 'Stake Your Tokens',
      description: 'Earn rewards with trusted validators',
      link: '#validators',
      cta: 'Start Staking',
      active: true,
    },
  ],
  
  'between-content': [
    {
      id: 'content-advertise',
      title: 'Advertise on WinScan',
      description: 'Reach thousands of crypto enthusiasts daily',
      link: 'mailto:ads@winscan.io',
      cta: 'Contact Us',
      active: true,
    },
  ],
  
  bottom: [
    {
      id: 'bottom-support',
      title: 'Support WinScan Development',
      description: 'Help us maintain and improve this free service',
      link: '#donate',
      cta: 'Donate',
      active: true,
    },
  ],
};

// Sponsored Validators Configuration
export const sponsoredValidators: SponsoredValidatorConfig[] = [
  // Example sponsored validators
  // {
  //   validatorAddress: 'cosmosvaloper1...',
  //   chainId: 'cosmoshub-4',
  //   startDate: '2025-01-01',
  //   endDate: '2025-12-31',
  //   priority: 100,
  //   active: true,
  // },
];

// Helper Functions
export const getActiveAds = (position: string): AdConfig[] => {
  const ads = bannerAds[position] || [];
  return ads.filter(ad => {
    if (!ad.active) return false;
    
    const now = new Date();
    if (ad.startDate && new Date(ad.startDate) > now) return false;
    if (ad.endDate && new Date(ad.endDate) < now) return false;
    
    return true;
  });
};

export const isSponsoredValidator = (validatorAddress: string, chainId: string): boolean => {
  const now = new Date();
  
  return sponsoredValidators.some(sponsor => {
    if (!sponsor.active) return false;
    if (sponsor.validatorAddress !== validatorAddress) return false;
    if (sponsor.chainId !== chainId) return false;
    
    const startDate = new Date(sponsor.startDate);
    const endDate = new Date(sponsor.endDate);
    
    return now >= startDate && now <= endDate;
  });
};

export const getSponsoredValidatorPriority = (validatorAddress: string, chainId: string): number => {
  const sponsor = sponsoredValidators.find(s => 
    s.active && 
    s.validatorAddress === validatorAddress && 
    s.chainId === chainId
  );
  
  return sponsor?.priority || 0;
};

// Track ad impressions and clicks
export const trackAdImpression = (adId: string) => {
  // Send to analytics
  console.log('Ad impression:', adId);
  
  // You can integrate with Google Analytics, Plausible, etc.
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'ad_impression', {
      ad_id: adId,
    });
  }
};

export const trackAdClick = (adId: string, link: string) => {
  // Send to analytics
  console.log('Ad click:', adId, link);
  
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'ad_click', {
      ad_id: adId,
      link: link,
    });
  }
};
