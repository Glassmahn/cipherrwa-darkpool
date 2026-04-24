"use client";

import { useEffect, useRef, useState } from "react";

export default function CipherRWALanding() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);

  // Custom cursor
  useEffect(() => {
    let rx = window.innerWidth / 2,
      ry = window.innerHeight / 2;
    let mx = rx,
      my = ry;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.left = mx + "px";
        cursorRef.current.style.top = my + "px";
      }
    };
    const anim = () => {
      rx += (mx - rx) * 0.1;
      ry += (my - ry) * 0.1;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      requestAnimationFrame(anim);
    };
    window.addEventListener("mousemove", onMove);
    anim();
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // 3D tilt on document
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!docRef.current) return;
      const dx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      docRef.current.style.transform = `rotateX(${-dy * 5}deg) rotateY(${dx * 7}deg) translateZ(8px)`;
    };
    const onLeave = () => {
      if (docRef.current) docRef.current.style.transform = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Scroll reveal
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 100) setHeaderVisible(true);
      if (window.scrollY > 400) setCardsVisible(true);
    };
    window.addEventListener("scroll", onScroll);
    // Trigger header on load
    setTimeout(() => setHeaderVisible(true), 300);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const services = [
    {
      stamp: "CLASSIFIED",
      title: "Confidential Orders",
      desc: "Place buy/sell orders with fully encrypted price, amount, and risk score. Zero plaintext ever touches the chain.",
      num: "01",
    },
    {
      stamp: "RESTRICTED",
      title: "Homomorphic Matching",
      desc: "Orders match via FHE comparison operators. No party reveals their position until Gateway settlement.",
      num: "02",
    },
    {
      stamp: "EYES ONLY",
      title: "RWA Settlement",
      desc: "Tokenized treasuries, real estate, and carbon credits settle confidentially via async Gateway decrypt.",
      num: "03",
    },
  ];

  const Y = "#F5C800";
  const ink = "#1a1200";
  const paper = "#e8dfc0";
  const muted = "#5a4e30";
  const red = "#8b1a1a";
  const blue = "#1a3a6b";

  return (
    <>
      {/* Cursor */}
      <div
        ref={cursorRef}
        style={{
          position: "fixed",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: Y,
          pointerEvents: "none",
          zIndex: 9999,
          transform: "translate(-50%,-50%)",
          boxShadow: `0 0 8px ${Y}`,
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `1px solid rgba(245,200,0,0.5)`,
          pointerEvents: "none",
          zIndex: 9998,
          transform: "translate(-50%,-50%)",
        }}
      />

      <main
        style={{
          background: "#0a0800",
          minHeight: "100vh",
          fontFamily: "'Courier New',monospace",
          overflowX: "hidden",
          cursor: "none",
        }}
      >
        {/* Scanlines */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9997,
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.012) 2px,rgba(0,0,0,0.012) 4px)",
          }}
        />

        {/* Nav */}
        <nav
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 3rem",
            background: "rgba(10,8,0,0.96)",
            borderBottom: "1px solid rgba(245,200,0,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: "1.1rem",
              letterSpacing: "0.15em",
              color: Y,
              fontWeight: 700,
            }}
          >
            CIPHER<span style={{ color: "#f0e6c0" }}>RWA</span>
          </div>
          <div style={{ display: "flex", gap: "2rem", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#5a4e30" }}>
            {["PROTOCOL", "DOCS", "GITHUB"].map((l) => (
              <span
                key={l}
                style={{ cursor: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = Y)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#5a4e30")}
              >
                {l}
              </span>
            ))}
          </div>
          <a
            href="/dashboard"
            style={{
              padding: "0.45rem 1.2rem",
              border: `1px solid ${Y}`,
              color: Y,
              fontSize: "0.65rem",
              letterSpacing: "0.15em",
              textDecoration: "none",
              cursor: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = Y;
              (e.currentTarget as HTMLAnchorElement).style.color = ink;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              (e.currentTarget as HTMLAnchorElement).style.color = Y;
            }}
          >
            LAUNCH APP →
          </a>
        </nav>

        {/* Hero */}
        <section
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6rem 2rem 5rem",
            position: "relative",
            overflow: "hidden",
            background: `radial-gradient(ellipse at 30% 50%,rgba(245,200,0,0.04) 0%,transparent 60%),radial-gradient(ellipse at 70% 30%,rgba(139,26,26,0.05) 0%,transparent 50%),#0a0800`,
          }}
        >
          {/* BG redact lines */}
          {[18, 28, 62, 72, 82].map((top, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                height: 1,
                background: "rgba(245,200,0,0.07)",
                left: 0,
                right: 0,
                top: `${top}%`,
                pointerEvents: "none",
              }}
            />
          ))}

          {/* Document */}
          <div style={{ perspective: 1400, position: "relative", zIndex: 10 }}>
            <div
              ref={docRef}
              style={{
                width: "min(700px, 92vw)",
                background: paper,
                padding: "3.5rem 3.5rem 2.8rem",
                position: "relative",
                transformStyle: "preserve-3d",
                boxShadow: `0 0 0 1px rgba(0,0,0,0.3),0 40px 100px rgba(0,0,0,0.9),0 0 80px rgba(245,200,0,0.04),inset 0 0 80px rgba(0,0,0,0.08)`,
                transition: "transform 0.15s ease-out",
              }}
            >
              {/* Burn marks */}
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: -12,
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "radial-gradient(circle,rgba(15,8,0,0.75) 0%,transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 55,
                  height: 55,
                  borderRadius: "50%",
                  background: "radial-gradient(circle,rgba(15,8,0,0.6) 0%,transparent 70%)",
                  pointerEvents: "none",
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -10,
                  left: 15,
                  width: 110,
                  height: 55,
                  borderRadius: "50%",
                  background: "radial-gradient(circle,rgba(15,8,0,0.6) 0%,transparent 70%)",
                  pointerEvents: "none",
                  opacity: 0.4,
                }}
              />

              {/* Paper noise overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  opacity: 0.5,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Fold line */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: 1,
                  background:
                    "linear-gradient(to right,transparent,rgba(0,0,0,0.08) 30%,rgba(0,0,0,0.12) 50%,rgba(0,0,0,0.08) 70%,transparent)",
                  pointerEvents: "none",
                }}
              />

              {/* TOP SECRET stamp */}
              <div
                style={{
                  position: "absolute",
                  top: "2rem",
                  left: "2.5rem",
                  border: `3px solid ${red}`,
                  color: red,
                  fontFamily: "Georgia,serif",
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  padding: "0.25rem 0.7rem",
                  transform: "rotate(-8deg)",
                  opacity: 0.82,
                }}
              >
                TOP SECRET
              </div>

              {/* Classification box */}
              <div
                style={{
                  position: "absolute",
                  top: "1.8rem",
                  right: "2.5rem",
                  border: `2px solid ${blue}`,
                  color: blue,
                  fontSize: "0.52rem",
                  letterSpacing: "0.12em",
                  padding: "0.35rem 0.5rem",
                  lineHeight: 1.5,
                  opacity: 0.65,
                }}
              >
                EXECUTIVE ORDER
                <br />
                ZAMA-FHEVM-001
                <br />
                APRIL 19, 2026
              </div>

              {/* Circle stamp */}
              <div
                style={{
                  position: "absolute",
                  bottom: "3rem",
                  right: "2.8rem",
                  width: 86,
                  height: 86,
                  borderRadius: "50%",
                  border: `3px solid rgba(139,26,26,0.55)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: "rotate(15deg)",
                  opacity: 0.6,
                }}
              >
                <div
                  style={{
                    width: 74,
                    height: 74,
                    borderRadius: "50%",
                    border: `1px solid rgba(139,26,26,0.35)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: "0.5rem",
                    color: red,
                    letterSpacing: "0.06em",
                    lineHeight: 1.4,
                    fontFamily: "Georgia,serif",
                  }}
                >
                  CONFIDENTIAL
                  <br />
                  DARK POOL
                  <br />
                  PROTOCOL
                </div>
              </div>

              {/* Header */}
              <div
                style={{
                  textAlign: "center",
                  marginBottom: "1.8rem",
                  paddingBottom: "1.2rem",
                  borderBottom: `2px solid rgba(26,18,0,0.25)`,
                }}
              >
                <div
                  style={{
                    fontFamily: "Georgia,serif",
                    fontSize: "1.45rem",
                    color: ink,
                    letterSpacing: "0.12em",
                    marginBottom: "0.3rem",
                    fontWeight: 700,
                  }}
                >
                  CLASSIFIED INFORMATION
                </div>
                <div style={{ fontSize: "0.68rem", color: muted, letterSpacing: "0.18em", fontStyle: "italic" }}>
                  For authorised personnel only — FHE clearance required
                </div>
              </div>

              {/* Meta */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.6rem",
                  color: muted,
                  letterSpacing: "0.08em",
                  marginBottom: "1.4rem",
                }}
              >
                <span>FILE REF: CIPHERRWA-DARKPOOL-V1</span>
                <span>CLASSIFICATION: EYES ONLY</span>
              </div>

              {/* Body */}
              <div style={{ fontSize: "0.77rem", lineHeight: 2, color: ink }}>
                <p style={{ marginBottom: "1.1rem", textAlign: "justify" }}>
                  CipherRWA is the first fully on-chain confidential dark pool for{" "}
                  <Redact>tokenized real world assets</Redact>. All order parameters — including{" "}
                  <Redact>price per token</Redact>, <Redact>trade amount</Redact>, and{" "}
                  <Redact>investor risk score</Redact> — are encrypted using Fully Homomorphic Encryption before
                  touching the chain. No plaintext is ever exposed to any party.
                </p>

                <div
                  style={{
                    fontFamily: "Georgia,serif",
                    fontSize: "0.78rem",
                    color: ink,
                    letterSpacing: "0.15em",
                    textDecoration: "underline",
                    margin: "1.3rem 0 0.5rem",
                    textTransform: "uppercase",
                  }}
                >
                  Deployed Infrastructure — Sepolia
                </div>

                {[
                  { label: "RWA TOKEN CONTRACT", addr: "0xd38489433B393F80281f5F59Abd9B82CCacE6194" },
                  { label: "DARK POOL CONTRACT", addr: "0x855dA715F3182f9A105343c91F80ba1B435BfD31" },
                  { label: "MATCHING ENGINE", addr: "0xEE66574d63535a344A0b044734fC2Ec0Be2a933d" },
                ].map((c) => (
                  <div
                    key={c.label}
                    style={{
                      background: "rgba(26,18,0,0.07)",
                      borderLeft: `3px solid ${Y}`,
                      padding: "0.5rem 0.9rem",
                      margin: "0.6rem 0",
                      fontSize: "0.65rem",
                      letterSpacing: "0.04em",
                      color: ink,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.52rem",
                        letterSpacing: "0.18em",
                        color: muted,
                        display: "block",
                        marginBottom: "0.15rem",
                      }}
                    >
                      {c.label}
                    </span>
                    {c.addr}
                  </div>
                ))}

                <p style={{ marginTop: "1rem", marginBottom: "1.1rem", textAlign: "justify" }}>
                  Matching is performed <Redact>homomorphically via TFHE.ge() operators</Redact> without decryption.
                  Settlement occurs via <Redact>Zama Gateway async decrypt</Redact> only upon execution. All
                  counterparty identities remain <Redact>encrypted using eaddress type</Redact>.
                </p>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginTop: "1.8rem",
                    paddingTop: "1.4rem",
                    borderTop: `1px solid rgba(26,18,0,0.18)`,
                    flexWrap: "wrap",
                  }}
                >
                  <a
                    href="/dashboard"
                    style={{
                      padding: "0.65rem 1.6rem",
                      background: ink,
                      color: Y,
                      fontFamily: "'Courier New',monospace",
                      fontSize: "0.65rem",
                      letterSpacing: "0.15em",
                      textDecoration: "none",
                      cursor: "none",
                      border: `2px solid ${ink}`,
                      transition: "all 0.2s",
                      fontWeight: 700,
                    }}
                    onMouseEnter={(e) => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.style.background = Y;
                      a.style.color = ink;
                      a.style.borderColor = Y;
                    }}
                    onMouseLeave={(e) => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.style.background = ink;
                      a.style.color = Y;
                      a.style.borderColor = ink;
                    }}
                  >
                    ► ACCESS DARK POOL
                  </a>
                  <a
                    href="#services"
                    style={{
                      padding: "0.65rem 1.6rem",
                      background: "transparent",
                      color: muted,
                      fontFamily: "'Courier New',monospace",
                      fontSize: "0.65rem",
                      letterSpacing: "0.15em",
                      textDecoration: "none",
                      cursor: "none",
                      border: `1px solid rgba(26,18,0,0.25)`,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.style.borderColor = ink;
                      a.style.color = ink;
                    }}
                    onMouseLeave={(e) => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.style.borderColor = "rgba(26,18,0,0.25)";
                      a.style.color = muted;
                    }}
                  >
                    VIEW PROTOCOL SPECS ↓
                  </a>
                </div>

                {/* Signature */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginTop: "1.3rem",
                    fontSize: "0.58rem",
                    color: muted,
                    letterSpacing: "0.08em",
                  }}
                >
                  <div>
                    <div style={{ marginBottom: "0.25rem" }}>AUTHORISED BY:</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: "0.95rem", color: ink }}>
                      CipherRWA Protocol
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>NETWORK: SEPOLIA TESTNET</div>
                    <div>ENCRYPTION: ZAMA FHEVM v0.6</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section
          id="services"
          style={{ padding: "6rem 3rem", background: "#0a0800", position: "relative", zIndex: 10 }}
        >
          <div
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.35em",
              color: Y,
              marginBottom: "0.7rem",
              opacity: headerVisible ? 1 : 0,
              transform: headerVisible ? "translateY(0)" : "translateY(10px)",
              transition: "all 0.6s",
            }}
          >
            001 / PROTOCOL SPECIFICATIONS
          </div>
          <h2
            style={{
              fontFamily: "Georgia,serif",
              fontSize: "clamp(1.8rem,4vw,3rem)",
              color: "#f0e6c0",
              lineHeight: 1.1,
              marginBottom: "3rem",
              opacity: headerVisible ? 1 : 0,
              transform: headerVisible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.8s ease 0.1s",
            }}
          >
            DISCOVER
            <br />
            <span style={{ color: Y }}>THE PROTOCOL</span>
          </h2>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {services.map((svc, i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 220px",
                  background: paper,
                  padding: "2rem 1.8rem",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "none",
                  opacity: cardsVisible ? 1 : 0,
                  transform: cardsVisible ? "translateY(0)" : "translateY(50px)",
                  transition: `all 0.9s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.12}s`,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(-6px) rotate(0.4deg)";
                  el.style.boxShadow = "0 20px 60px rgba(0,0,0,0.7)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "0 10px 40px rgba(0,0,0,0.6)";
                }}
              >
                {/* paper noise */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    opacity: 0.5,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
                  }}
                />
                <div
                  style={{
                    fontSize: "0.48rem",
                    letterSpacing: "0.25em",
                    color: red,
                    border: `1px solid ${red}`,
                    display: "inline-block",
                    padding: "0.12rem 0.45rem",
                    marginBottom: "0.8rem",
                    opacity: 0.65,
                    transform: "rotate(-2deg)",
                  }}
                >
                  {svc.stamp}
                </div>
                <div style={{ width: 36, height: 2, background: Y, marginBottom: "0.9rem" }} />
                <h3
                  style={{
                    fontFamily: "Georgia,serif",
                    fontSize: "0.9rem",
                    color: ink,
                    letterSpacing: "0.04em",
                    marginBottom: "0.7rem",
                  }}
                >
                  {svc.title}
                </h3>
                <p style={{ fontSize: "0.7rem", lineHeight: 1.8, color: muted }}>{svc.desc}</p>
                <div
                  style={{
                    position: "absolute",
                    bottom: "0.8rem",
                    right: "1.2rem",
                    fontSize: "2.8rem",
                    fontWeight: 700,
                    color: "rgba(26,18,0,0.05)",
                    fontFamily: "Georgia,serif",
                    lineHeight: 1,
                  }}
                >
                  {svc.num}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ticker */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            padding: "0.5rem 3rem",
            borderTop: "1px solid rgba(245,200,0,0.1)",
            background: "rgba(10,8,0,0.97)",
            display: "flex",
            gap: "2.5rem",
            alignItems: "center",
            fontSize: "0.52rem",
            letterSpacing: "0.15em",
            color: "#3a2e0a",
          }}
        >
          <span>
            RWA: <span style={{ color: Y }}>0xd384...6194</span>
          </span>
          <span>
            DARKPOOL: <span style={{ color: Y }}>0x855d...FD31</span>
          </span>
          <span>
            ENGINE: <span style={{ color: Y }}>0xEE66...933d</span>
          </span>
          <span style={{ color: Y, marginLeft: "auto", animation: "blink 3s infinite" }}>● LIVE ON SEPOLIA</span>
        </div>

        <style>{`
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
          html{scroll-behavior:smooth;}
        `}</style>
      </main>
    </>
  );
}

// Redact component — hover to reveal
function Redact({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      style={{
        display: "inline-block",
        background: revealed ? "rgba(245,200,0,0.15)" : "#F5C800",
        color: revealed ? "#1a1200" : "transparent",
        padding: "0 3px",
        borderRadius: 1,
        cursor: "none",
        transition: "all 0.3s",
        boxShadow: revealed ? "0 0 12px rgba(245,200,0,0.4)" : "none",
      }}
    >
      {children}
    </span>
  );
}
