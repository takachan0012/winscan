import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AutoCompoundBot } from './AutoCompoundBot';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

let bot: AutoCompoundBot | null = null;

async function initializeBot() {
  if (!process.env.OPERATOR_MNEMONIC) {
    console.log('⚠️ OPERATOR_MNEMONIC not set, bot disabled');
    return;
  }

  console.log('🤖 Initializing Auto-Compound Bot...');
  bot = new AutoCompoundBot(process.env.OPERATOR_MNEMONIC);
  
  await bot.initialize();
  console.log('✅ Bot initialized successfully');

  if (process.env.BOT_AUTO_START === 'true') {
    await bot.start();
    console.log('🚀 Bot started automatically');

    const fs = require('fs');
    const path = require('path');
    
    const possiblePaths = [
      path.join(__dirname, '../../Chains'),
      path.join(__dirname, '../Chains'),
      path.join(process.cwd(), 'Chains'),
      path.join(process.cwd(), '../Chains'),
    ];

    let chainsDir = null;
    for (const dir of possiblePaths) {
      if (fs.existsSync(dir)) {
        chainsDir = dir;
        console.log(`📁 Found Chains directory: ${dir}`);
        break;
      }
    }

    if (!chainsDir) {
      console.error('❌ Chains directory not found in any expected location');
      console.log('Searched paths:', possiblePaths);
      return;
    }

    const files = fs.readdirSync(chainsDir);
    console.log(`📂 Found ${files.length} files in Chains directory`);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const chainData = JSON.parse(
            fs.readFileSync(path.join(chainsDir, file), 'utf8')
          );

          if (!chainData.apis || !chainData.apis.rpc || !chainData.apis.rest) {
            console.log(`⏭️ Skipping ${file}: Missing apis.rpc or apis.rest structure`);
            continue;
          }

          const chainConfig = {
            chainId: chainData.chain_id,
            rpc: chainData.apis.rpc[0].address,
            rest: chainData.apis.rest[0].address,
            prefix: chainData.bech32_prefix,
            denom: chainData.staking?.staking_tokens[0]?.denom || chainData.fees?.fee_tokens[0]?.denom,
            gasPrice: `0.025${chainData.fees?.fee_tokens[0]?.denom || 'stake'}`,
            coinType: chainData.coin_type,
          };

          console.log(`🔄 Loading tasks from ${chainConfig.chainId}...`);
          await bot.loadTasksFromChain(chainConfig);
          console.log(`✅ Loaded tasks from ${chainConfig.chainId}`);
        } catch (error) {
          console.error(`⚠️ Failed to load ${file}:`, error);
        }
      }
    }
  }
}


app.get('/api/status', (req, res) => {
  if (!bot) {
    return res.status(503).json({ error: 'Bot not initialized' });
  }
  res.json(bot.getStatus());
});

app.post('/api/start', async (req, res) => {
  if (!bot) {
    return res.status(503).json({ error: 'Bot not initialized' });
  }
  await bot.start();
  res.json({ message: 'Bot started successfully' });
});

app.post('/api/stop', (req, res) => {
  if (!bot) {
    return res.status(503).json({ error: 'Bot not initialized' });
  }
  bot.stop();
  res.json({ message: 'Bot stopped successfully' });
});

app.post('/api/load-tasks/:chainId', async (req, res) => {
  if (!bot) {
    return res.status(503).json({ error: 'Bot not initialized' });
  }

  const { chainId } = req.params;
  
  const fs = require('fs');
  const path = require('path');
  
  const possiblePaths = [
    path.join(__dirname, '../../Chains'),
    path.join(__dirname, '../Chains'),
    path.join(process.cwd(), 'Chains'),
    path.join(process.cwd(), '../Chains'),
  ];

  let chainsDir = null;
  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      chainsDir = dir;
      break;
    }
  }

  if (!chainsDir) {
    return res.status(500).json({ error: 'Chains directory not found' });
  }

  const files = fs.readdirSync(chainsDir);

  let chainConfig = null;
  for (const file of files) {
    if (file.endsWith('.json')) {
      const chainData = JSON.parse(
        fs.readFileSync(path.join(chainsDir, file), 'utf8')
      );

      if (chainData.chain_id === chainId) {
        if (!chainData.apis || !chainData.apis.rpc || !chainData.apis.rest) {
          return res.status(400).json({ error: `Chain ${chainId} missing apis.rpc or apis.rest structure` });
        }

        chainConfig = {
          chainId: chainData.chain_id,
          rpc: chainData.apis.rpc[0].address,
          rest: chainData.apis.rest[0].address,
          prefix: chainData.bech32_prefix,
          denom: chainData.staking?.staking_tokens[0]?.denom || chainData.fees?.fee_tokens[0]?.denom,
          gasPrice: `0.025${chainData.fees?.fee_tokens[0]?.denom || 'stake'}`,
          coinType: chainData.coin_type,
        };
        break;
      }
    }
  }

  if (!chainConfig) {
    return res.status(404).json({ error: `Chain ${chainId} not found` });
  }

  await bot.loadTasksFromChain(chainConfig);
  res.json({
    message: `Tasks loaded from ${chainId}`,
    status: bot.getStatus(),
  });
});

app.post('/api/execute', async (req, res) => {
  if (!bot) {
    return res.status(503).json({ error: 'Bot not initialized' });
  }

  const { chainId, granter, validator } = req.body;

  if (!chainId || !granter || !validator) {
    return res.status(400).json({
      error: 'chainId, granter, and validator are required',
    });
  }

  const task = {
    chainId,
    granter,
    validator,
    frequency: 'hourly' as const,
    lastRun: undefined,
  };

  await (bot as any).executeAutoCompound(task);

  res.json({
    message: 'Auto-compound executed',
    task,
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Auto-Compound Bot Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  await initializeBot();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  if (bot) bot.stop();
  process.exit(0);
});
