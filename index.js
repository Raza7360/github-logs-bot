import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'openlabsdevs';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOS = process.env.GITHUB_REPOS ? process.env.GITHUB_REPOS.split(',') : [];
const POLL_INTERVAL = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

// Initialize bot without polling (no commands needed)
const bot = new TelegramBot(BOT_TOKEN);

// Store last checked timestamp
let lastCheckedTime = new Date();
let isInitialCheck = true;
let allRepos = []; // Cache all repositories

// GitHub API headers
const githubHeaders = {
  'Accept': 'application/vnd.github.v3+json',
  ...(GITHUB_TOKEN && { 'Authorization': `token ${GITHUB_TOKEN}` })
};

// Fetch all repositories for the user/org
async function fetchAllRepos() {
  try {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&type=all`;
    console.log(`[>] Fetching all repositories for: ${GITHUB_USERNAME}`);
    const response = await axios.get(url, { headers: githubHeaders });
    const repos = response.data.map(repo => repo.full_name);
    console.log(`[#] Found ${repos.length} repositories: ${repos.join(', ')}`);
    allRepos = repos; // Update cache
    return repos;
  } catch (error) {
    console.error(`[-] Error fetching repositories: ${error.message}`);
    return [];
  }
}

// Format activity message
function formatActivity(event) {
  const { type, repo, created_at, payload, actor } = event;
  let message = `[+] *GitHub Activity*\n\n`;
  message += `[>] User: [${actor.login}](https://github.com/${actor.login})\n`;
  message += `[#] Repository: [${repo.name}](https://github.com/${repo.name})\n`;
  message += `[@] Time: ${new Date(created_at).toLocaleString()}\n\n`;

  switch (type) {
    case 'PushEvent':
      const commits = payload.commits?.length || 0;
      message += `[~] *Push Event*\n`;
      message += `Branch: \`${payload.ref.split('/').pop()}\`\n`;
      message += `Commits: ${commits}\n`;
      if (payload.commits && payload.commits.length > 0) {
        message += `\nLatest commit:\n_${payload.commits[0].message}_`;
      }
      break;

    case 'CreateEvent':
      message += `[+] *Create Event*\n`;
      message += `Type: ${payload.ref_type}\n`;
      if (payload.ref) message += `Name: \`${payload.ref}\``;
      break;

    case 'DeleteEvent':
      message += `[-] *Delete Event*\n`;
      message += `Type: ${payload.ref_type}\n`;
      message += `Name: \`${payload.ref}\``;
      break;

    case 'IssuesEvent':
      message += `[!] *Issue ${payload.action}*\n`;
      message += `Title: [${payload.issue.title}](${payload.issue.html_url})\n`;
      message += `#${payload.issue.number}`;
      break;

    case 'IssueCommentEvent':
      message += `[*] *Comment on Issue*\n`;
      message += `Issue: [#${payload.issue.number}](${payload.issue.html_url})\n`;
      message += `Comment: _${payload.comment.body.substring(0, 100)}${payload.comment.body.length > 100 ? '...' : ''}_`;
      break;

    case 'PullRequestEvent':
      message += `[<>] *Pull Request ${payload.action}*\n`;
      message += `Title: [${payload.pull_request.title}](${payload.pull_request.html_url})\n`;
      message += `#${payload.pull_request.number}`;
      break;

    case 'PullRequestReviewEvent':
      message += `[?] *PR Review ${payload.action}*\n`;
      message += `PR: [#${payload.pull_request.number}](${payload.pull_request.html_url})\n`;
      message += `State: ${payload.review.state}`;
      break;

    case 'PullRequestReviewCommentEvent':
      message += `[*] *Comment on PR*\n`;
      message += `PR: [#${payload.pull_request.number}](${payload.pull_request.html_url})`;
      break;

    case 'WatchEvent':
      message += `[*] *Starred the repository*`;
      break;

    case 'ForkEvent':
      message += `[Y] *Forked the repository*\n`;
      message += `Fork: [${payload.forkee.full_name}](${payload.forkee.html_url})`;
      break;

    case 'ReleaseEvent':
      message += `[^] *Release ${payload.action}*\n`;
      message += `Tag: [${payload.release.tag_name}](${payload.release.html_url})\n`;
      message += `Name: ${payload.release.name}`;
      break;

    default:
      message += `[.] *${type.replace('Event', '')}*`;
  }

  return message;
}

// Send summary message to bot chat and group
async function sendSummary(activities) {
  const periodText = isInitialCheck ? 'Server Startup - All Recent Events' : 'Last 5 Hours';
  const MAX_MESSAGE_LENGTH = 4000; // Telegram limit is 4096, using 4000 for safety

  // Build header
  let header = `\n${'='.repeat(50)}\n`;
  header += `  GitHub Activity Summary - ${GITHUB_USERNAME}\n`;
  header += `  Period: ${periodText}\n`;
  header += `  Total Activities: ${activities.length}\n`;
  header += `${'='.repeat(50)}\n\n`;

  if (activities.length === 0) {
    const summary = header + `[i] No new activities during this period.\n${'-'.repeat(50)}\n`;

    try {
      if (CHAT_ID) {
        await bot.sendMessage(CHAT_ID, summary, { parse_mode: 'Markdown' });
        console.log(`[+] Sent summary to chat: ${activities.length} activities`);
      }
      if (GROUP_ID) {
        await bot.sendMessage(GROUP_ID, summary, { parse_mode: 'Markdown' });
        console.log(`[+] Sent summary to group: ${activities.length} activities`);
      }
    } catch (error) {
      console.error(`[-] Error sending message: ${error.message}`);
    }
    return;
  }

  // Split activities into chunks
  const messages = [];
  let currentMessage = header;
  let messageCount = 1;

  for (const activity of activities) {
    const activityText = formatActivity(activity) + `\n${'-'.repeat(50)}\n\n`;

    // Check if adding this activity would exceed the limit
    if ((currentMessage + activityText).length > MAX_MESSAGE_LENGTH) {
      messages.push(currentMessage);
      // Start new message with continuation header
      currentMessage = `\n${'='.repeat(50)}\n`;
      currentMessage += `  GitHub Activity Summary (continued ${++messageCount})\n`;
      currentMessage += `${'='.repeat(50)}\n\n`;
      currentMessage += activityText;
    } else {
      currentMessage += activityText;
    }
  }

  // Add the last message
  if (currentMessage.length > header.length) {
    messages.push(currentMessage);
  }

  // Send all messages
  try {
    for (let i = 0; i < messages.length; i++) {
      if (CHAT_ID) {
        await bot.sendMessage(CHAT_ID, messages[i], { parse_mode: 'Markdown' });
      }
      if (GROUP_ID) {
        await bot.sendMessage(GROUP_ID, messages[i], { parse_mode: 'Markdown' });
      }
      // Small delay between messages to avoid rate limiting
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    console.log(`[+] Sent ${messages.length} message(s) with ${activities.length} total activities`);
  } catch (error) {
    console.error(`[-] Error sending message: ${error.message}`);
  }
}

// Fetch GitHub activities
async function fetchGitHubActivities(sendAlways = false) {
  try {
    let allActivities = [];

    // Fetch user/org events
    const userUrl = `https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=100`;
    console.log(`[>] Fetching user events from: ${userUrl}`);
    const userResponse = await axios.get(userUrl, { headers: githubHeaders });
    allActivities.push(...userResponse.data);

    // Use cached repos or configured repos
    const reposToMonitor = GITHUB_REPOS.length > 0 ? GITHUB_REPOS : allRepos;

    // Fetch repository events for each repo
    for (const repo of reposToMonitor) {
      const repoUrl = `https://api.github.com/repos/${repo.trim()}/events?per_page=100`;
      console.log(`[>] Fetching repo events from: ${repoUrl}`);
      try {
        const repoResponse = await axios.get(repoUrl, { headers: githubHeaders });
        allActivities.push(...repoResponse.data);
      } catch (repoError) {
        console.error(`[-] Error fetching events for repo ${repo}: ${repoError.message}`);
      }
    }

    // Remove duplicates based on event id
    const uniqueActivities = Array.from(
      new Map(allActivities.map(event => [event.id, event])).values()
    );

    // Sort by created_at (newest first)
    const activities = uniqueActivities.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    console.log(`[#] Total events fetched: ${activities.length}`);

    // Debug: Show event types
    const eventTypes = activities.map(e => e.type);
    console.log(`[i] Event types: ${[...new Set(eventTypes)].join(', ')}`);

    let activitiesToSend;

    // On initial check (server restart), send ALL available events
    if (isInitialCheck) {
      activitiesToSend = activities;
      isInitialCheck = false;
      console.log(`[!] Initial check - sending all ${activitiesToSend.length} events`);
    } else {
      // For subsequent checks, only send new activities
      activitiesToSend = activities.filter(
        event => new Date(event.created_at) > lastCheckedTime
      );
      console.log(`[+] Found ${activitiesToSend.length} new activities`);
    }

    if (activitiesToSend.length > 0 || sendAlways) {
      // Send activities in chronological order (oldest first)
      await sendSummary(activitiesToSend.reverse());

      // Update last checked time
      if (activities.length > 0) {
        lastCheckedTime = new Date(activities[0].created_at);
      }
    } else {
      console.log('[i] No new activities');
    }
  } catch (error) {
    console.error(`[-] Error fetching GitHub activities: ${error.message}`);
    if (error.response) {
      console.error(`[!] Response status: ${error.response.status}`);
      console.error(`[!] Rate limit remaining: ${error.response.headers['x-ratelimit-remaining']}`);
    }
  }
}

// Main function to fetch repos and activities
async function monitorGitHub() {
  console.log('[i] Starting GitHub monitoring cycle...');

  // Step 1: Fetch all repositories
  await fetchAllRepos();

  // Step 2: Fetch activities for all repos
  await fetchGitHubActivities(true);

  console.log('[i] Monitoring cycle completed.\n');
}

// Start monitoring
console.log('\n' + '='.repeat(60));
console.log('  GitHub Activity Monitor Bot');
console.log('='.repeat(60));
console.log(`[>] Monitoring: ${GITHUB_USERNAME}`);
console.log(`[>] Repositories: ${GITHUB_REPOS.length > 0 ? GITHUB_REPOS.join(', ') : 'Will fetch all repos'}`);
console.log(`[@] Poll interval: ${POLL_INTERVAL / 1000 / 60 / 60} hours`);
console.log(`[#] Chat ID: ${CHAT_ID || 'Not set'}`);
console.log(`[#] Group ID: ${GROUP_ID || 'Not set'}`);
console.log('='.repeat(60) + '\n');

// Initial check on startup (fetch repos + activities)
console.log('[!] Running initial check on server startup...');
monitorGitHub();

// Start polling every 5 hours
setInterval(monitorGitHub, POLL_INTERVAL);