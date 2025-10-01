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
const POLL_INTERVAL = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

// Initialize bot without polling (no commands needed)
const bot = new TelegramBot(BOT_TOKEN);

// Store last checked timestamp
let lastCheckedTime = new Date();
let isInitialCheck = true;

// GitHub API headers
const githubHeaders = {
  'Accept': 'application/vnd.github.v3+json',
  ...(GITHUB_TOKEN && { 'Authorization': `token ${GITHUB_TOKEN}` })
};

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

  let summary = `\n${'='.repeat(50)}\n`;
  summary += `  GitHub Activity Summary - ${GITHUB_USERNAME}\n`;
  summary += `  Period: ${periodText}\n`;
  summary += `  Total Activities: ${activities.length}\n`;
  summary += `${'='.repeat(50)}\n\n`;

  if (activities.length === 0) {
    summary += `[i] No new activities during this period.\n`;
    summary += `${'-'.repeat(50)}\n`;
  } else {
    for (const activity of activities) {
      summary += formatActivity(activity);
      summary += `\n${'-'.repeat(50)}\n\n`;
    }
  }

  try {
    // Send to bot chat
    if (CHAT_ID) {
      await bot.sendMessage(CHAT_ID, summary, { parse_mode: 'Markdown' });
      console.log(`[+] Sent summary to chat: ${activities.length} activities`);
    }

    // Send to group
    if (GROUP_ID) {
      await bot.sendMessage(GROUP_ID, summary, { parse_mode: 'Markdown' });
      console.log(`[+] Sent summary to group: ${activities.length} activities`);
    }
  } catch (error) {
    console.error(`[-] Error sending message: ${error.message}`);
  }
}

// Fetch GitHub activities
async function fetchGitHubActivities(sendAlways = false) {
  try {
    // Use /events instead of /events/public to get all events (including PRs to other repos)
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=100`;
    console.log(`[>] Fetching from: ${url}`);
    const response = await axios.get(url, { headers: githubHeaders });

    const activities = response.data;
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

// Start monitoring
console.log('\n' + '='.repeat(60));
console.log('  GitHub Activity Monitor Bot');
console.log('='.repeat(60));
console.log(`[>] Monitoring: ${GITHUB_USERNAME}`);
console.log(`[@] Poll interval: ${POLL_INTERVAL / 1000 / 60 / 60} hours`);
console.log(`[#] Chat ID: ${CHAT_ID || 'Not set'}`);
console.log(`[#] Group ID: ${GROUP_ID || 'Not set'}`);
console.log('='.repeat(60) + '\n');

// Initial check on startup (always send report)
console.log('[i] Running initial check and sending startup summary...');
fetchGitHubActivities(true);

// Start polling every 5 hours
setInterval(fetchGitHubActivities, POLL_INTERVAL);