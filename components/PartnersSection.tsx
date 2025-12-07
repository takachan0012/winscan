'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Partner {
  name: string;
  logo: string;
  website: string;
  description: string;
  chain_name?: string;
}

export default function PartnersSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPartners() {
      try {
        const response = await fetch('/api/chains');
        const chains = await response.json();
        
        // Filter chains that have website and logo, deduplicate by base name
        const seenBaseNames = new Set<string>();
        const partnerChains: Partner[] = chains
          .filter((chain: any) => chain.website && chain.logo)
          .filter((chain: any) => {
            // Remove -mainnet, -test, -testnet suffixes to get base name
            const baseName = chain.chain_name
              .replace(/-mainnet$/i, '')
              .replace(/-testnet$/i, '')
              .replace(/-test$/i, '');
            
            if (seenBaseNames.has(baseName.toLowerCase())) {
              return false; // Skip duplicates
            }
            seenBaseNames.add(baseName.toLowerCase());
            return true;
          })
          .map((chain: any) => ({
            name: chain.pretty_name || chain.chain_name,
            logo: chain.logo,
            website: chain.website,
            description: chain.description || `Explore ${chain.pretty_name || chain.chain_name} blockchain`,
            chain_name: chain.chain_name
          }));

        setPartners(partnerChains);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load partners:', error);
        setIsLoading(false);
      }
    }

    loadPartners();
  }, []);

  const itemsPerSlide = 6;
  const totalSlides = Math.ceil(partners.length / itemsPerSlide);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const currentPartners = partners.slice(
    currentSlide * itemsPerSlide,
    (currentSlide + 1) * itemsPerSlide
  );

  if (isLoading || partners.length === 0) {
    return null;
  }

  return (
    <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">
            Our Partners
          </h2>
          <p className="text-gray-500 text-sm">
            Powering the multi-chain ecosystem with trusted blockchain networks
          </p>
        </div>

        <div className="relative">
          {/* Navigation Buttons */}
          {totalSlides > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-gray-900 border border-gray-800 rounded-full p-2 shadow-lg hover:bg-gray-800 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6 text-gray-300" />
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-gray-900 border border-gray-800 rounded-full p-2 shadow-lg hover:bg-gray-800 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6 text-gray-300" />
              </button>
            </>
          )}

          {/* Partners Grid */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-4 max-w-3xl">
              {currentPartners.map((partner, index) => (
              <a
                key={`${partner.chain_name || partner.name}-${index}`}
                href={partner.website}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gray-900 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center text-center border border-gray-800 hover:border-blue-500"
              >
                <div className="relative w-16 h-16 mb-3">
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    fill
                    className="object-contain group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/icon-192x192.png';
                    }}
                  />
                </div>
                <h3 className="font-semibold text-white text-sm mb-2 group-hover:text-blue-400 transition-colors">
                  {partner.name}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2">
                  {partner.description}
                </p>
                  </a>
              ))}
            </div>
          </div>

          {/* Slide Indicators */}
          {totalSlides > 1 && (
            <div className="flex justify-center mt-8 gap-2">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'bg-blue-500 w-8'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
