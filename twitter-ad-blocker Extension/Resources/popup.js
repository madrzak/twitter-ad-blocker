console.log("Hello World!", browser);

// Initialize the popup
document.addEventListener('DOMContentLoaded', function() {
    // Get stored ad count or initialize to 0
    browser.storage.local.get('adsBlocked').then(result => {
        const count = result.adsBlocked || 0;
        document.getElementById('count').textContent = count;
    }).catch(error => {
        console.error('Error getting ad count:', error);
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

console.log("Twitter/X Ad Blocker popup script loaded");
