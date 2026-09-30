"use client";

import React, { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Register service worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Check dismissal status in session
    const dismissed = localStorage.getItem("techomie_pwa_dismissed");
    if (!dismissed && !standalone) {
      setIsDismissed(false);
    }

    // Capture install prompt on Chromium browsers
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!standalone && !dismissed) {
        setIsDismissed(false);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Detect when app gets installed
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      console.log("[PWA] Techomie Flow was successfully installed!");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsDismissed(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("techomie_pwa_dismissed", "true");
  };

  if (isStandalone || isDismissed) {
    return null;
  }

  // Only show if prompt is ready or if on iOS
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 99999,
          maxWidth: "380px",
          width: "calc(100% - 40px)",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "14px",
          padding: "14px 16px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backdropFilter: "blur(12px)",
          animation: "slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <img
          src="/icons/icon-192x192.png"
          alt="Techomie Flow"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            boxShadow: "0 0 12px rgba(14, 165, 233, 0.4)",
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#F8FAFC",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>Install Techomie Flow</span>
            <span
              style={{
                fontSize: "10px",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38BDF8",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              App
            </span>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "#94A3B8",
              marginTop: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Faster access & full-screen workspace
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={handleInstallClick}
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(2, 132, 199, 0.3)",
              transition: "transform 0.1s ease, filter 0.1s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              background: "transparent",
              color: "#64748B",
              border: "none",
              borderRadius: "6px",
              padding: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94A3B8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
          >
            ✕
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div
          onClick={() => setShowIosGuide(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0F172A",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "16px",
              padding: "20px",
              maxWidth: "360px",
              width: "100%",
              color: "#F8FAFC",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 10px 0", color: "#38BDF8" }}>
              Install on iOS Safari
            </h3>
            <ol style={{ fontSize: "13px", color: "#CBD5E1", paddingLeft: "20px", lineHeight: "1.6", margin: 0 }}>
              <li>
                Tap the <strong>Share</strong> button (
                <span style={{ fontSize: "14px" }}>⎋</span> / square with arrow) in Safari’s bottom bar.
              </li>
              <li>
                Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.
              </li>
              <li>Tap <strong>&quot;Add&quot;</strong> in the top right.</li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              style={{
                marginTop: "16px",
                width: "100%",
                background: "#1E293B",
                color: "#38BDF8",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                padding: "8px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
