#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>

static NSString *const kElectrobunVibrancyViewIdentifier =
	@"ElectrobunVibrancyView";
static NSString *const kElectrobunNativeDragViewIdentifier =
	@"ElectrobunNativeDragView";
static const void *kElectrobunTrafficLightsObserverKey =
	&kElectrobunTrafficLightsObserverKey;

static BOOL applyTrafficLightsPosition(NSWindow *window, double x,
											   double yFromTop) {
	if (window == nil || ![window isKindOfClass:[NSWindow class]]) {
		return NO;
	}

	NSButton *closeButton = [window standardWindowButton:NSWindowCloseButton];
	NSButton *minimizeButton =
		[window standardWindowButton:NSWindowMiniaturizeButton];
	NSButton *zoomButton = [window standardWindowButton:NSWindowZoomButton];

	if (closeButton == nil || minimizeButton == nil || zoomButton == nil) {
		return NO;
	}

	NSView *buttonContainer = [closeButton superview];
	if (buttonContainer == nil) {
		return NO;
	}

	CGFloat spacing = NSMinX(minimizeButton.frame) - NSMinX(closeButton.frame);
	if (spacing <= 0) {
		spacing = closeButton.frame.size.width + 6.0;
	}

	BOOL flipped = [buttonContainer isFlipped];
	CGFloat targetY = yFromTop;
	if (!flipped) {
		targetY = buttonContainer.frame.size.height - yFromTop -
				  closeButton.frame.size.height;
	}
	targetY = MAX(0.0, targetY);

	CGFloat currentX = x;
	NSArray<NSButton *> *buttons = @[ closeButton, minimizeButton, zoomButton ];
	for (NSButton *button in buttons) {
		[button setFrameOrigin:NSMakePoint(currentX, targetY)];
		currentX += spacing;
	}

	[buttonContainer setNeedsLayout:YES];
	[buttonContainer layoutSubtreeIfNeeded];
	[window invalidateShadow];
	return YES;
}

@interface ElectrobunTrafficLightsObserver : NSObject
@property(nonatomic, weak) NSWindow *window;
@property(nonatomic) double x;
@property(nonatomic) double yFromTop;
- (instancetype)initWithWindow:(NSWindow *)window;
- (BOOL)apply;
@end

@implementation ElectrobunTrafficLightsObserver
- (instancetype)initWithWindow:(NSWindow *)window {
	self = [super init];
	if (self == nil) {
		return nil;
	}

	_window = window;
	[[NSNotificationCenter defaultCenter]
		addObserver:self
		   selector:@selector(handleWindowDidResize:)
			   name:NSWindowDidResizeNotification
			 object:window];
	[[NSNotificationCenter defaultCenter]
		addObserver:self
		   selector:@selector(handleWindowDidResize:)
			   name:NSWindowDidEndLiveResizeNotification
			 object:window];
	[[NSNotificationCenter defaultCenter]
		addObserver:self
		   selector:@selector(handleWindowWillClose:)
			   name:NSWindowWillCloseNotification
			 object:window];

	return self;
}

- (void)dealloc {
	[[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleWindowDidResize:(NSNotification *)notification {
	(void)notification;
	[self apply];
}

- (void)handleWindowWillClose:(NSNotification *)notification {
	(void)notification;
	NSWindow *window = self.window;
	if (window != nil) {
		objc_setAssociatedObject(window, kElectrobunTrafficLightsObserverKey, nil,
								 OBJC_ASSOCIATION_RETAIN_NONATOMIC);
	}
}

- (BOOL)apply {
	return applyTrafficLightsPosition(self.window, self.x, self.yFromTop);
}
@end

@interface ElectrobunNativeDragView : NSView
@end

@implementation ElectrobunNativeDragView
- (BOOL)isOpaque {
	return NO;
}

- (void)drawRect:(NSRect)dirtyRect {
	(void)dirtyRect;
}

- (void)mouseDown:(NSEvent *)event {
	NSWindow *window = [self window];
	if (window != nil && event != nil) {
		[window performWindowDragWithEvent:event];
	}
}
@end

static NSVisualEffectView *findVibrancyView(NSView *contentView) {
	for (NSView *subview in [contentView subviews]) {
		if ([subview isKindOfClass:[NSVisualEffectView class]] &&
			[[subview identifier]
				isEqualToString:kElectrobunVibrancyViewIdentifier]) {
			return (NSVisualEffectView *)subview;
		}
	}

	return nil;
}

static ElectrobunNativeDragView *findNativeDragView(NSView *contentView) {
	for (NSView *subview in [contentView subviews]) {
		if ([subview isKindOfClass:[ElectrobunNativeDragView class]] &&
			[[subview identifier]
				isEqualToString:kElectrobunNativeDragViewIdentifier]) {
			return (ElectrobunNativeDragView *)subview;
		}
	}

	return nil;
}

extern "C" bool enableWindowVibrancy(void *windowPtr,
									  bool titleBarTransparent) {
	if (windowPtr == nullptr) {
		return false;
	}

	__block BOOL success = NO;
	dispatch_sync(dispatch_get_main_queue(), ^{
		NSWindow *window = (__bridge NSWindow *)windowPtr;
		if (![window isKindOfClass:[NSWindow class]]) {
			return;
		}

		[window setOpaque:NO];
		[window setBackgroundColor:[NSColor clearColor]];
		[window setTitlebarAppearsTransparent:titleBarTransparent ? YES : NO];
		[window setHasShadow:YES];

		NSView *contentView = [window contentView];
		if (contentView == nil) {
			return;
		}

		NSVisualEffectView *effectView = findVibrancyView(contentView);

		if (effectView == nil) {
			effectView = [[NSVisualEffectView alloc]
				initWithFrame:[contentView bounds]];
			[effectView setIdentifier:kElectrobunVibrancyViewIdentifier];
			[effectView
				setAutoresizingMask:(NSViewWidthSizable | NSViewHeightSizable)];
		}

		if (@available(macOS 10.14, *)) {
			[effectView setMaterial:NSVisualEffectMaterialUnderWindowBackground];
		} else {
			[effectView setMaterial:NSVisualEffectMaterialSidebar];
		}
		[effectView setBlendingMode:NSVisualEffectBlendingModeBehindWindow];
		[effectView setState:NSVisualEffectStateActive];

		if ([effectView superview] == nil) {
			NSView *relativeView = [[contentView subviews] firstObject];
			if (relativeView != nil) {
				[contentView addSubview:effectView
							 positioned:NSWindowBelow
							 relativeTo:relativeView];
			} else {
				[contentView addSubview:effectView];
			}
		}

		[window invalidateShadow];
		success = YES;
	});

	return success;
}

extern "C" bool ensureWindowShadow(void *windowPtr) {
	if (windowPtr == nullptr) {
		return false;
	}

	__block BOOL success = NO;
	dispatch_sync(dispatch_get_main_queue(), ^{
		NSWindow *window = (__bridge NSWindow *)windowPtr;
		if (![window isKindOfClass:[NSWindow class]]) {
			return;
		}

		[window setHasShadow:YES];
		[window invalidateShadow];
		success = YES;
	});

	return success;
}

extern "C" bool setWindowTrafficLightsPosition(void *windowPtr, double x, double yFromTop) {
	if (windowPtr == nullptr) {
		return false;
	}

	__block BOOL success = NO;
	dispatch_sync(dispatch_get_main_queue(), ^{
		NSWindow *window = (__bridge NSWindow *)windowPtr;
		if (window == nil || ![window isKindOfClass:[NSWindow class]]) {
			return;
		}

		ElectrobunTrafficLightsObserver *observer =
			objc_getAssociatedObject(window, kElectrobunTrafficLightsObserverKey);
		if (observer == nil) {
			observer = [[ElectrobunTrafficLightsObserver alloc] initWithWindow:window];
			objc_setAssociatedObject(window, kElectrobunTrafficLightsObserverKey,
							 observer, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
		}

		observer.x = x;
		observer.yFromTop = yFromTop;
		success = [observer apply];
	});

	return success;
}

extern "C" bool setTrafficLightsVisible(void *windowPtr, bool visible) {
	if (windowPtr == nullptr) {
		return false;
	}

	__block BOOL success = NO;
	dispatch_sync(dispatch_get_main_queue(), ^{
		NSWindow *window = (__bridge NSWindow *)windowPtr;
		if (![window isKindOfClass:[NSWindow class]]) {
			return;
		}

		NSButton *closeButton =
			[window standardWindowButton:NSWindowCloseButton];
		NSButton *minimizeButton =
			[window standardWindowButton:NSWindowMiniaturizeButton];
		NSButton *zoomButton = [window standardWindowButton:NSWindowZoomButton];

		[closeButton setHidden:!visible];
		[minimizeButton setHidden:!visible];
		[zoomButton setHidden:!visible];
		success = YES;
	});

	return success;
}

extern "C" bool setNativeWindowDragRegion(void *windowPtr, double x,
										  double height) {
	if (windowPtr == nullptr) {
		return false;
	}

	__block BOOL success = NO;
	dispatch_sync(dispatch_get_main_queue(), ^{
		NSWindow *window = (__bridge NSWindow *)windowPtr;
		if (![window isKindOfClass:[NSWindow class]]) {
			return;
		}

		NSView *contentView = [window contentView];
		if (contentView == nil) {
			return;
		}

		CGFloat dragX = MAX(0.0, x);
		CGFloat dragHeight = MAX(0.0, height);
		CGFloat dragWidth = MAX(0.0, contentView.bounds.size.width - dragX);
		if (dragHeight <= 0.0 || dragWidth <= 0.0) {
			return;
		}

		BOOL flipped = [contentView isFlipped];
		CGFloat dragY = flipped ? 0.0 : contentView.bounds.size.height - dragHeight;
		dragY = MAX(0.0, dragY);

		ElectrobunNativeDragView *dragView = findNativeDragView(contentView);
		if (dragView == nil) {
			dragView = [[ElectrobunNativeDragView alloc] initWithFrame:NSZeroRect];
			[dragView setIdentifier:kElectrobunNativeDragViewIdentifier];
		}

		[dragView setFrame:NSMakeRect(dragX, dragY, dragWidth, dragHeight)];
		[dragView setAutoresizingMask:NSViewWidthSizable];

		if ([dragView superview] == nil) {
			[contentView addSubview:dragView
						 positioned:NSWindowAbove
						 relativeTo:nil];
		}

		success = YES;
	});

	return success;
}
