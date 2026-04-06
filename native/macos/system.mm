#import <Cocoa/Cocoa.h>
#import <ServiceManagement/ServiceManagement.h>

// SMAppService status enum for FFI
// We use int values that map to SMAppServiceStatus but can be bridged to C
//
// SMAppServiceStatus values:
//   NotRegistered = 0  - Service not registered
//   Enabled = 1        - Service registered and running
//   RequiresApproval = 2 - Service registered but user approval needed in System Settings
//   NotFound = 3       - Error occurred

/**
 * Register the main app as a login item using SMAppService.
 * @return YES if registration succeeded, NO otherwise
 */
extern "C" bool registerMainAppLoginItem() {
    __block BOOL success = NO;
    dispatch_sync(dispatch_get_main_queue(), ^{
        SMAppService *service = [SMAppService mainAppService];
        NSError *error = nil;
        success = [service registerAndReturnError:&error];
        if (error != nil) {
            NSLog(@"[Pincer] Failed to register login item: %@", error);
        }
    });
    return success;
}

/**
 * Unregister the main app as a login item.
 * @return YES if unregistration succeeded, NO otherwise
 */
extern "C" bool unregisterMainAppLoginItem() {
    __block BOOL success = NO;
    dispatch_sync(dispatch_get_main_queue(), ^{
        SMAppService *service = [SMAppService mainAppService];
        NSError *error = nil;
        success = [service unregisterAndReturnError:&error];
        if (error != nil) {
            NSLog(@"[Pincer] Failed to unregister login item: %@", error);
        }
    });
    return success;
}

/**
 * Get the current status of the main app login item.
 * @return Status code: 0=NotRegistered, 1=Enabled, 2=RequiresApproval, 3=NotFound
 */
extern "C" int getMainAppLoginItemStatus() {
    __block int status = 3; // NotFound as default
    dispatch_sync(dispatch_get_main_queue(), ^{
        SMAppService *service = [SMAppService mainAppService];
        switch (service.status) {
            case SMAppServiceStatusEnabled:
                status = 1;
                break;
            case SMAppServiceStatusRequiresApproval:
                status = 2;
                break;
            case SMAppServiceStatusNotRegistered:
                status = 0;
                break;
            default:
                status = 3;
                break;
        }
    });
    return status;
}

/**
 * Open the Login Items section in System Settings.
 * Useful when status is RequiresApproval.
 */
extern "C" bool openLoginItemsSettings() {
    __block BOOL success = NO;
    dispatch_sync(dispatch_get_main_queue(), ^{
        NSURL *url = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.LoginItems-Settings.extension"];
        success = [[NSWorkspace sharedWorkspace] openURL:url];
    });
    return success;
}

/**
 * Check if SMAppService API is available (macOS 13+).
 * @return YES if available, NO otherwise
 */
extern "C" bool isSMAppServiceAvailable() {
    // SMAppService was introduced in macOS 13.0
    // Check if the class responds to mainAppService selector
    return [SMAppService respondsToSelector:@selector(mainAppService)];
}
