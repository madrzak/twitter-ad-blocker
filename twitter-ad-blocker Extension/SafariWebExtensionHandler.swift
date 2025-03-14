//
//  SafariWebExtensionHandler.swift
//  twitter-ad-blocker Extension
//
//  Created by Lukasz Madrzak on 14/03/2025.
//

import SafariServices
import os.log

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        os_log(.default, "🚀 Twitter Ad Blocker Safari Extension Loaded")

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["message": "Extension Loaded"]]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
