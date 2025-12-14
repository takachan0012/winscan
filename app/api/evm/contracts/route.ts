import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface ContractCreation {
  address: string;
  blockNumber: number;
  blockHash?: string;
  creator: string;
  txHash: string;
  timestamp?: number;
  bytecode?: string;
  gasUsed?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';

    if (!chain) {
      return NextResponse.json(
        { error: true, message: 'Chain parameter is required' },
        { status: 400 }
      );
    }

    // Fetch from external API
    const apiUrl = `https://ssl.winsnip.xyz/api/evm/contracts?chain=${chain}&page=${page}&limit=${limit}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      console.error(`Failed to fetch contracts: ${response.status}`);
      return NextResponse.json(
        {
          error: true,
          message: `Failed to fetch contract data: ${response.statusText}`,
          data: { contracts: [] }
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Normalize response format
    if (data.error === false && data.data) {
      return NextResponse.json(data);
    }

    // Return mock data if API fails or returns empty
    return NextResponse.json({
      error: false,
      message: 'Contract data retrieved successfully',
      data: {
        contracts: data.contracts || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: data.total || 0,
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching EVM contracts:', error);
    
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Failed to fetch contract data',
        data: { contracts: [] }
      },
      { status: 500 }
    );
  }
}
