console.log("Hello World!", browser);

// Initialize the popup
document.addEventListener('DOMContentLoaded', function() {
    // Get stored ad counts
    browser.storage.local.get(['adsBlocked', 'adsMarked', 'lowEngagementVerified', 'highViews']).then(result => {
        const blockedCount = result.adsBlocked || 0;
        const markedCount = result.adsMarked || 0;
        
        document.getElementById('blocked-count').textContent = blockedCount;
        document.getElementById('marked-count').textContent = markedCount;
        
        // Set toggle states from storage
        document.getElementById('low-engagement-verified').checked = result.lowEngagementVerified || false;
        document.getElementById('high-views').checked = result.highViews || false;
    }).catch(error => {
        console.error('Error getting stored data:', error);
    });
    
    // Add toggle event listeners
    document.getElementById('low-engagement-verified').addEventListener('change', function(e) {
        const isChecked = e.target.checked;
        browser.storage.local.set({ lowEngagementVerified: isChecked });
        
        // Send message to content script to update filtering
        browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
            browser.tabs.sendMessage(tabs[0].id, {
                action: 'updateFilters',
                filters: { lowEngagementVerified: isChecked }
            });
        });
    });
    
    document.getElementById('high-views').addEventListener('change', function(e) {
        const isChecked = e.target.checked;
        browser.storage.local.set({ highViews: isChecked });
        
        // Send message to content script to update filtering
        browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
            browser.tabs.sendMessage(tabs[0].id, {
                action: 'updateFilters',
                filters: { highViews: isChecked }
            });
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
            statusIndicator.style.backgroundColor = '#E0245E'; // Twitter red
            statusText.textContent = 'Not active on this page';
            filtersSection.style.opacity = '0.5';
            filterToggles.forEach(toggle => toggle.disabled = true);
        } else if (!isHomePage) {
            statusText.textContent = 'Active (filters work on home page only)';
            filtersSection.style.opacity = '0.5';
            filterToggles.forEach(toggle => {
                toggle.disabled = true;
                toggle.checked = false;
            });
            // Reset filter states in storage when not on home page
            browser.storage.local.set({ 
                lowEngagementVerified: false,
                highViews: false
            });
            // Notify content script to disable filters
            browser.tabs.sendMessage(tabs[0].id, {
                action: 'updateFilters',
                filters: { 
                    lowEngagementVerified: false,
                    highViews: false
                }
            });
        } else {
            filtersSection.style.opacity = '1';
            filterToggles.forEach(toggle => toggle.disabled = false);
        }
    }).catch(error => {
        console.error('Error checking current tab:', error);
    });
});

console.log("Twitter/X Ad Blocker & Marker popup script loaded");
