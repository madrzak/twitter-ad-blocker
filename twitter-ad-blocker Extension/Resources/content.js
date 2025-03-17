browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
    console.log("Received response: ", response);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
    
    if (request.action === 'updateFilters') {
        if (request.filters.hasOwnProperty('verifiedOnly')) {
            verifiedOnly = request.filters.verifiedOnly;
            // Reset other filters when verified-only is enabled
            if (verifiedOnly) {
                filterLowEngagementVerified = false;
                filterHighViews = false;
            }
            // Reset processed state when filter changes
            document.querySelectorAll('[data-filter-processed]').forEach(tweet => {
                tweet.removeAttribute('data-filter-processed');
            });
        }
        if (request.filters.hasOwnProperty('lowEngagementVerified')) {
            filterLowEngagementVerified = request.filters.lowEngagementVerified;
            // Reset processed state when filter changes
            document.querySelectorAll('[data-filter-processed]').forEach(tweet => {
                tweet.removeAttribute('data-filter-processed');
            });
        }
        if (request.filters.hasOwnProperty('highViews')) {
            filterHighViews = request.filters.highViews;
            // Reset processed state when filter changes
            document.querySelectorAll('[data-filter-processed]').forEach(tweet => {
                tweet.removeAttribute('data-filter-processed');
            });
        }
        applyFilters();
    }
});

// Track how many ads we've blocked or marked
let adsBlockedCount = 0;
let adsMarkedCount = 0;

// Add verifiedOnly to the state tracking
let verifiedOnly = false;
let filterLowEngagementVerified = false;
let filterHighViews = false;

// Add debounce function at the top level
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create and inject CSS for the promoted badge
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .twitter-ad-blocker-badge {
            display: inline-flex;
            align-items: center;
            background-color: rgba(255, 0, 0, 0.1);
            color: #FF3333;
            border-radius: 4px;
            padding: 0 6px;
            margin-left: 4px;
            font-size: 12px;
            font-weight: bold;
            height: 18px;
        }
        
        .twitter-ad-blocker-badge-container {
            display: flex;
            align-items: center;
        }
        
        [data-ad-marked="true"] {
            border: 1px solid rgba(255, 0, 0, 0.2) !important;
            background-color: rgba(255, 0, 0, 0.03) !important;
            border-radius: 12px !important;
        }
    `;
    document.head.appendChild(style);
}

// Helper function to get today's date key
function getTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

// Function to update stats
function updateStats(type) {
    browser.storage.local.get(['adsBlocked', 'adsMarked', 'dailyStats']).then(result => {
        const totalBlocked = (result.adsBlocked || 0) + (type === 'blocked' ? 1 : 0);
        const totalMarked = (result.adsMarked || 0) + (type === 'marked' ? 1 : 0);
        
        // Update daily stats
        const dailyStats = result.dailyStats || {};
        const todayKey = getTodayKey();
        if (!dailyStats[todayKey]) {
            dailyStats[todayKey] = { blocked: 0, marked: 0 };
        }
        
        if (type === 'blocked') {
            dailyStats[todayKey].blocked++;
        } else if (type === 'marked') {
            dailyStats[todayKey].marked++;
        }
        
        // Store updated stats
        browser.storage.local.set({
            adsBlocked: totalBlocked,
            adsMarked: totalMarked,
            dailyStats: dailyStats
        });
        
        // Notify popup of updated stats
        browser.runtime.sendMessage({
            type: 'statsUpdate',
            totalBlocked,
            totalMarked,
            todayBlocked: dailyStats[todayKey].blocked,
            todayMarked: dailyStats[todayKey].marked
        });
    });
}

// Update the processTwitterContent function to use the new updateStats function
function processTwitterContent() {
    const tweets = document.querySelectorAll('article[role="article"]');
    
    tweets.forEach(tweet => {
        if (tweet.hasAttribute('data-ad-processed')) {
            return;
        }
        tweet.setAttribute('data-ad-processed', 'true');
        
        const promotedText = tweet.textContent.toLowerCase();
        if (promotedText.includes('promoted')) {
            if (!tweet.hasAttribute('data-ad-marked')) {
                tweet.setAttribute('data-ad-marked', 'true');
                updateStats('marked');
                
                const badge = document.createElement('div');
                badge.className = 'promoted-badge';
                badge.textContent = 'AD';
                tweet.appendChild(badge);
            }
            
            if (!tweet.hasAttribute('data-ad-blocked')) {
                tweet.setAttribute('data-ad-blocked', 'true');
                updateStats('blocked');
                tweet.style.display = 'none';
            }
        }
    });
}

function blockAds() {
    // These selectors will be hidden completely
    const hideSelectors = [
        '[data-testid="placementTracking"]', // Promoted tweets (block them)
        '[aria-label="Ad"]', // Explicitly labeled ads
        'div[data-testid="top-impression-pixel"]', // Impression pixels
        'div[data-testid="bottom-impression-pixel"]',
        'div[data-testid="right-impression-pixel"]',
        'div[data-testid="left-impression-pixel"]',
        'a[href*="premium_sign_up"]', // "Subscribe to Premium" ads
        'div[data-testid="inlinePrompt"]', // Inline prompts
        'aside[aria-label="Subscribe to Premium"]', // Premium sidebar
        'aside[aria-label="Who to follow"]', // Who to follow sidebar
        'div[aria-label="Timeline: Trending now"]', // Trending sidebar
        'a[href*="referring_page=ad_static_general"]' // Ad tracking links
    ];
    
    // Hide ads completely
    hideSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(ad => {
            if (!ad.dataset.hidden) {
                // For promoted tweets, we need to hide the entire tweet container
                if (selector === '[data-testid="placementTracking"]' || selector === '[aria-label="Ad"]') {
                    const tweetContainer = ad.closest('article') || ad.closest('[data-testid="tweet"]');
                    if (tweetContainer && !tweetContainer.dataset.hidden) {
                        console.log(`❌ Blocking Twitter/X Ad: "${tweetContainer.innerText.slice(0, 50)}..."`);
                        tweetContainer.style.display = "none";
                        tweetContainer.dataset.hidden = "true";
                        
                        // Increment counter and update storage
                        adsBlockedCount++;
                        browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                        
                        // Report to background script
                        browser.runtime.sendMessage({ adBlocked: tweetContainer.innerText.slice(0, 50) });
                    }
                } else {
                    // For other ad elements, just hide the element itself
                    console.log(`❌ Hiding Twitter/X Ad element: ${selector}`);
                    ad.style.display = "none";
                    ad.dataset.hidden = "true";
                    
                    // Increment counter and update storage
                    adsBlockedCount++;
                    browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                    
                    // Report to background script
                    browser.runtime.sendMessage({ adBlocked: "Hidden Ad Element" });
                }
            }
        });
    });
    
    // Check for promoted content in spans
    const promotedElements = document.querySelectorAll('span');
    promotedElements.forEach(element => {
        if (element.textContent.includes('Promoted') && !element.dataset.hidden) {
            const tweetContainer = element.closest('article') || element.closest('[data-testid="tweet"]');
            if (tweetContainer && !tweetContainer.dataset.hidden) {
                console.log(`❌ Blocking Twitter/X Ad with "Promoted" text: "${tweetContainer.innerText.slice(0, 50)}..."`);
                tweetContainer.style.display = "none";
                tweetContainer.dataset.hidden = "true";
                
                // Increment counter and update storage
                adsBlockedCount++;
                browser.storage.local.set({ 'adsBlocked': adsBlockedCount });
                
                // Report to background script
                browser.runtime.sendMessage({ adBlocked: tweetContainer.innerText.slice(0, 50) });
            }
        }
    });
}

function markPromotedTweets() {
    // This is a separate feature that marks promoted tweets with a badge
    // We'll use a different dataset attribute to avoid conflicts with the blocking feature
    
    // Find all promoted tweets that haven't been marked yet
    const promotedTweets = document.querySelectorAll('[data-testid="placementTracking"], [aria-label="Ad"]');
    promotedTweets.forEach(tweet => {
        if (!tweet.dataset.adMarked) {
            // Find the tweet container
            const tweetContainer = tweet.closest('article') || tweet.closest('[data-testid="tweet"]') || tweet;
            
            // Skip if this tweet is already hidden by the ad blocker
            if (tweetContainer.dataset.hidden) return;
            
            // Mark the tweet container
            tweetContainer.dataset.adMarked = "true";
            
            // Find the username container to add our badge
            const userNameContainer = tweetContainer.querySelector('[data-testid="User-Name"]');
            if (userNameContainer && !userNameContainer.querySelector('.twitter-ad-blocker-badge')) {
                // Create badge container
                const badgeContainer = document.createElement('div');
                badgeContainer.className = 'twitter-ad-blocker-badge-container';
                
                // Create badge
                const badge = document.createElement('div');
                badge.className = 'twitter-ad-blocker-badge';
                badge.textContent = 'Promoted Tweet';
                
                // Add badge to container
                badgeContainer.appendChild(badge);
                
                // Add badge after username
                userNameContainer.appendChild(badgeContainer);
                
                console.log(`🏷️ Marked Twitter/X Ad: "${tweetContainer.innerText.slice(0, 50)}..."`);
                
                // Increment counter and update storage
                adsMarkedCount++;
                browser.storage.local.set({ 'adsMarked': adsMarkedCount });
                
                // Report to background script
                browser.runtime.sendMessage({ adMarked: tweetContainer.innerText.slice(0, 50) });
            }
        }
    });
    
    // Check for promoted content in spans
    const promotedElements = document.querySelectorAll('span');
    promotedElements.forEach(element => {
        if (element.textContent.includes('Promoted') && !element.dataset.adMarked) {
            element.dataset.adMarked = "true";
            
            // Find the tweet container
            const tweetContainer = element.closest('article') || element.closest('[data-testid="tweet"]');
            
            // Skip if this tweet is already hidden by the ad blocker
            if (tweetContainer && tweetContainer.dataset.hidden) return;
            
            if (tweetContainer && !tweetContainer.dataset.adMarked) {
                // Mark the tweet container
                tweetContainer.dataset.adMarked = "true";
                
                // Find the username container to add our badge
                const userNameContainer = tweetContainer.querySelector('[data-testid="User-Name"]');
                if (userNameContainer && !userNameContainer.querySelector('.twitter-ad-blocker-badge')) {
                    // Create badge container
                    const badgeContainer = document.createElement('div');
                    badgeContainer.className = 'twitter-ad-blocker-badge-container';
                    
                    // Create badge
                    const badge = document.createElement('div');
                    badge.className = 'twitter-ad-blocker-badge';
                    badge.textContent = 'Promoted Tweet';
                    
                    // Add badge to container
                    badgeContainer.appendChild(badge);
                    
                    // Add badge after username
                    userNameContainer.appendChild(badgeContainer);
                    
                    console.log(`🏷️ Marked Twitter/X Ad: "${tweetContainer.innerText.slice(0, 50)}..."`);
                    
                    // Increment counter and update storage
                    adsMarkedCount++;
                    browser.storage.local.set({ 'adsMarked': adsMarkedCount });
                    
                    // Report to background script
                    browser.runtime.sendMessage({ adMarked: tweetContainer.innerText.slice(0, 50) });
                }
            }
        }
    });
}

function applyFilters() {
    // Only apply filters on the home page
    if (!window.location.pathname.endsWith('/home')) {
        return;
    }
    
    console.log("Applying filters - Verified Only:", verifiedOnly, "High Views:", filterHighViews, "Low Engagement Verified:", filterLowEngagementVerified);
    
    // Get all tweets that haven't been processed yet
    const tweets = document.querySelectorAll('article[role="article"]:not([data-filter-processed])');
    
    tweets.forEach(tweet => {
        // Mark as processed
        tweet.setAttribute('data-filter-processed', 'true');
        
        let shouldShow = true;
        const isVerified = tweet.querySelector('[data-testid="icon-verified"]') !== null;
        
        if (verifiedOnly) {
            shouldShow = isVerified;
        } else if (filterLowEngagementVerified || filterHighViews) {
            // Default to hiding when any filter is active
            shouldShow = false;
            
            if (filterLowEngagementVerified && !filterHighViews) {
                const likeCount = getLikeCount(tweet);
                if (isVerified && likeCount < 3) {
                    shouldShow = true;
                }
            }
            
            if (filterHighViews && !filterLowEngagementVerified) {
                const viewCount = getViewCount(tweet);
                console.log("Tweet views:", viewCount);
                if (viewCount > 1000) {
                    shouldShow = true;
                }
            }
            
            // If both filters are active, post must satisfy both conditions
            if (filterHighViews && filterLowEngagementVerified) {
                const likeCount = getLikeCount(tweet);
                const viewCount = getViewCount(tweet);
                if (isVerified && likeCount < 3 && viewCount > 1000) {
                    shouldShow = true;
                }
            }
        }
        
        // Store the filter state on the tweet
        tweet.setAttribute('data-should-show', shouldShow);
        
        // Apply visibility
        tweet.style.display = shouldShow ? '' : 'none';
    });
}

function getLikeCount(tweet) {
    const likeElement = tweet.querySelector('[data-testid="like"] [class*="r-bcqeeo"]');
    if (!likeElement) return 999; // If can't determine, assume high number
    
    const likeText = likeElement.textContent.trim();
    if (!likeText) return 999;
    
    // Parse like count, handling K/M suffixes
    if (likeText.includes('K')) {
        return parseFloat(likeText) * 1000;
    } else if (likeText.includes('M')) {
        return parseFloat(likeText) * 1000000;
    } else {
        return parseInt(likeText) || 999;
    }
}

function getViewCount(tweet) {
    const viewElement = tweet.querySelector('[aria-label*="views"]');
    if (!viewElement) return 0; // If can't determine, assume low number
    
    const viewText = viewElement.textContent.trim();
    if (!viewText) return 0;
    
    // Parse view count, handling K/M suffixes
    if (viewText.includes('K')) {
        return parseFloat(viewText) * 1000;
    } else if (viewText.includes('M')) {
        return parseFloat(viewText) * 1000000;
    } else {
        return parseInt(viewText) || 0;
    }
}

// Get existing counts from storage
browser.storage.local.get(['adsBlocked', 'adsMarked']).then(result => {
    adsBlockedCount = result.adsBlocked || 0;
    adsMarkedCount = result.adsMarked || 0;
}).catch(error => {
    console.error('Error getting ad counts:', error);
});

// Get filter states from storage
browser.storage.local.get(['lowEngagementVerified', 'highViews']).then(result => {
    filterLowEngagementVerified = result.lowEngagementVerified || false;
    filterHighViews = result.highViews || false;
    if (filterLowEngagementVerified || filterHighViews) {
        applyFilters();
    }
}).catch(error => {
    console.error('Error getting filter states:', error);
});

// Inject our custom styles
injectStyles();

// Create a debounced version of applyFilters
const debouncedApplyFilters = debounce(applyFilters, 250);

// Modify the observer to use the debounced function
const observer = new MutationObserver((mutations) => {
    let shouldApplyFilters = false;
    
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            // Check if any of the added nodes are tweets or contain tweets
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('article[role="article"]') || 
                        node.querySelector('article[role="article"]')) {
                        shouldApplyFilters = true;
                        break;
                    }
                }
            }
        }
    }
    
    processTwitterContent();
    
    if (shouldApplyFilters && (filterLowEngagementVerified || filterHighViews)) {
        debouncedApplyFilters();
    }
});

// Add scroll event listener for infinite scroll handling
const scrollHandler = debounce(() => {
    if (filterLowEngagementVerified || filterHighViews) {
        applyFilters();
    }
}, 250);

window.addEventListener('scroll', scrollHandler);

// Initial execution to catch existing ads
processTwitterContent();

console.log("🚀 Twitter/X Ad Blocker & Marker is active!");
