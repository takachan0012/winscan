'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function EVMPage() {
  const params = useParams();
  const chain = params.chain as string;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">EVM Explorer</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Explore EVM blocks and transactions
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blocks Card */}
          <Link href={`/${chain}/evm/blocks`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Blocks</h2>
              <p className="text-gray-600 dark:text-gray-400">
                View all EVM blocks, block details, and block information
              </p>
              <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400">
                <span className="mr-2">View Blocks</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Transactions Card */}
          <Link href={`/${chain}/evm/transactions`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Transactions</h2>
              <p className="text-gray-600 dark:text-gray-400">
                View all EVM transactions, transaction details, and transfer history
              </p>
              <div className="mt-4 flex items-center text-green-600 dark:text-green-400">
                <span className="mr-2">View Transactions</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
