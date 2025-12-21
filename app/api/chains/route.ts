import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const chainsDir = path.join(process.cwd(), 'Chains');
    
    // Read all JSON files from Chains directory
    const files = fs.readdirSync(chainsDir).filter(file => file.endsWith('.json'));
    
    const chains = files.map(file => {
      const filePath = path.join(chainsDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    });
    
    // Sort by chain_name
    chains.sort((a, b) => a.chain_name.localeCompare(b.chain_name));
    
    return NextResponse.json(chains, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error loading chains:', error);
    return NextResponse.json(
      { error: 'Failed to load chains' },
      { status: 500 }
    );
  }
}
