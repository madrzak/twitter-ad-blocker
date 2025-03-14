console.log("Hello World!", browser);

// Initialize the popup
document.addEventListener('DOMContentLoaded', function() {
    // Get stored ad counts
    browser.storage.local.get(['adsBlocked', 'adsMarked']).then(result => {
        const blockedCount = result.adsBlocked || 0;
        const markedCount = result.adsMarked || 0;
        
        document.getElementById('blocked-count').textContent = blockedCount;
        document.getElementById('marked-count').textContent = markedCount;
    }).catch(error => {
        console.error('Error getting ad counts:', error);
    });
    
    // Check if we're on Twitter/X
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        const currentTab = tabs[0];
        const isTwitterOrX = currentTab.url.includes('twitter.com') || currentTab.url.includes('x.com');
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status span');
        
        if (!isTwitterOrX) {
            statusIndicator.classList.remove('active');
            statusIndicator.style.backgroundColor = '#E0245E'; // Twitter red
            statusText.textContent = 'Not active on this page';
        }
    }).catch(error => {
        console.error('Error checking current tab:', error);
    });
});

console.log("Twitter/X Ad Blocker & Marker popup script loaded");
