import { Octokit } from '@octokit/rest'
import fs from 'fs/promises'
import path from 'path'

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function downloadRepository() {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Get repository tree
    const { data: tree } = await octokit.rest.git.getTree({
      owner: 'enginysar81',
      repo: 'erp-system',
      tree_sha: 'HEAD',
      recursive: true
    });

    console.log(`Found ${tree.tree.length} items in repository`);
    
    // Skip problematic directories
    const skipPaths = ['.local', '.replit', 'replit.md'];
    
    // Create directories and download files
    for (const item of tree.tree) {
      // Skip problematic paths
      if (skipPaths.some(skip => item.path.startsWith(skip))) {
        console.log(`Skipped: ${item.path}`);
        continue;
      }
      
      if (item.type === 'blob' && item.path) {
        // Create directory if needed
        const dir = path.dirname(item.path);
        if (dir !== '.') {
          await fs.mkdir(dir, { recursive: true });
        }
        
        // Download file content
        const { data: blob } = await octokit.rest.git.getBlob({
          owner: 'enginysar81',
          repo: 'erp-system',
          file_sha: item.sha
        });
        
        // Write file
        const content = Buffer.from(blob.content, 'base64');
        await fs.writeFile(item.path, content);
        console.log(`Downloaded: ${item.path}`);
      } else if (item.type === 'tree' && item.path) {
        // Create directory
        await fs.mkdir(item.path, { recursive: true });
        console.log(`Created directory: ${item.path}`);
      }
    }
    
    console.log('Repository download completed!');
    
  } catch (error) {
    console.error('Error downloading repository:', error.message);
  }
}

downloadRepository();