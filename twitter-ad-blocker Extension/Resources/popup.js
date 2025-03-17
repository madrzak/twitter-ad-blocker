console.log("Hello World!", browser);

// Declare state variables at the top level
let verifiedOnly = false;
let lowEngagementVerified = false;
let highViews = false;

// Helper function to get today's date key
function getTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', function() {
    // Get stored ad counts and filter states
    browser.storage.local.get([
        'adsBlocked', 
        'adsMarked', 
        'lowEngagementVerified', 
        'highViews', 
        'verifiedOnly',
        'dailyStats'
    ]).then(result => {
        const blockedCount = result.adsBlocked || 0;
        const markedCount = result.adsMarked || 0;
        
        // Get today's stats
        const dailyStats = result.dailyStats || {};
        const todayKey = getTodayKey();
        const todayStats = dailyStats[todayKey] || { blocked: 0, marked: 0 };
        
        // Update total stats
        document.getElementById('blocked-count').textContent = blockedCount;
        document.getElementById('marked-count').textContent = markedCount;
        
        // Update today's stats
        document.getElementById('blocked-count-today').textContent = todayStats.blocked;
        document.getElementById('marked-count-today').textContent = todayStats.marked;
        
        // Set toggle states and variables from storage
        verifiedOnly = result.verifiedOnly || false;
        lowEngagementVerified = result.lowEngagementVerified || false;
        highViews = result.highViews || false;
        
        document.getElementById('verified-only').checked = verifiedOnly;
        document.getElementById('low-engagement-verified').checked = lowEngagementVerified;
        document.getElementById('high-views').checked = highViews;
        
        // Update toggle states based on verified-only
        updateToggleStates();
    }).catch(error => {
        console.error('Error getting stored data:', error);
    });
    
    // Function to update other toggles' disabled state
    function updateToggleStates() {
        const lowEngagementToggle = document.getElementById('low-engagement-verified');
        const highViewsToggle = document.getElementById('high-views');
        
        lowEngagementToggle.disabled = verifiedOnly;
        highViewsToggle.disabled = verifiedOnly;
        
        // If verified-only is enabled, uncheck other toggles
        if (verifiedOnly) {
            lowEngagementToggle.checked = false;
            highViewsToggle.checked = false;
            lowEngagementVerified = false;
            highViews = false;
        }
    }
    
    // Add event listener for verified-only toggle
    document.getElementById('verified-only').addEventListener('change', function(e) {
        verifiedOnly = e.target.checked;
        browser.storage.local.set({ verifiedOnly: verifiedOnly });
        
        updateToggleStates();
        
        // Send message to content script
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url && (currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com'))) {
                browser.tabs.sendMessage(currentTab.id, {
                    action: 'updateFilters',
                    filters: {
                        verifiedOnly: verifiedOnly,
                        lowEngagementVerified: false,
                        highViews: false
                    }
                });
            }
        });
    });
    
    // Add event listener for low-engagement-verified toggle
    document.getElementById('low-engagement-verified').addEventListener('change', function(e) {
        if (verifiedOnly) {
            e.target.checked = false;
            return;
        }
        lowEngagementVerified = e.target.checked;
        browser.storage.local.set({ lowEngagementVerified: lowEngagementVerified });
        
        // Send message to content script
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url && (currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com'))) {
                browser.tabs.sendMessage(currentTab.id, {
                    action: 'updateFilters',
                    filters: { lowEngagementVerified: lowEngagementVerified }
                });
            }
        });
    });
    
    // Add event listener for high-views toggle
    document.getElementById('high-views').addEventListener('change', function(e) {
        if (verifiedOnly) {
            e.target.checked = false;
            return;
        }
        highViews = e.target.checked;
        browser.storage.local.set({ highViews: highViews });
        
        // Send message to content script
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url && (currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com'))) {
                browser.tabs.sendMessage(currentTab.id, {
                    action: 'updateFilters',
                    filters: { highViews: highViews }
                });
            }
        });
    });
    
    // Check if we're on Twitter/X and specifically on the home page
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        const currentTab = tabs[0];
        const isTwitterOrX = currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com');
        const isHomePage = currentTab.url.endsWith('/home');
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status span');
        const filtersSection = document.querySelector('.filters');
        const filterToggles = document.querySelectorAll('.filter-option input[type="checkbox"]');
        
        if (!isTwitterOrX) {
            statusIndicator.classList.remove('active');
            statusIndicator.style.backgroundColor = '#E0245E';
            statusText.textContent = 'Not active on this page';
            filtersSection.style.opacity = '0.5';
            filterToggles.forEach(toggle => toggle.disabled = true);
        } else if (!isHomePage) {
            statusText.textContent = 'Active (filters work on home page only)';
            filtersSection.style.opacity = '0.5';
            filterToggles.forEach(toggle => toggle.disabled = true);
        } else {
            filtersSection.style.opacity = '1';
            filterToggles.forEach(toggle => {
                toggle.disabled = verifiedOnly && toggle.id !== 'verified-only';
            });
        }
    }).catch(error => {
        console.error('Error checking current tab:', error);
    });
    
    // Display extension version
    const manifest = browser.runtime.getManifest();
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = manifest.version;
    }
});

// Listen for messages from content script about new blocked/marked ads
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'statsUpdate') {
        // Update total counts
        document.getElementById('blocked-count').textContent = message.totalBlocked;
        document.getElementById('marked-count').textContent = message.totalMarked;
        
        // Update today's counts
        document.getElementById('blocked-count-today').textContent = message.todayBlocked;
        document.getElementById('marked-count-today').textContent = message.todayMarked;
    }
});

console.log("Twitter/X Ad Blocker & Marker popup script loaded");
