export default function JiwooInteractiveMascot({
  mode = "greeting",
  onClick,
  className = "",
}) {
  return (
    <div
      onClick={onClick}
      title="Klik Jiwoo untuk memutar ulang suara & animasi bicara"
      className={`relative select-none cursor-pointer ${className}`}
    >
      <svg
        id="jiwoo-cat-svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 450"
        className={`w-full h-full object-contain state-${mode}`}
      >
        <defs>
          <style>{`
            #waving-arm, #cat-head-group, #resting-paw, #ear-left-group, #ear-right-group {
              transition: transform 0.3s ease-in-out;
            }
            #waving-arm { transform-origin: 205px 352px; }
            #cat-head-group { transform-origin: 315px 352px; }
            #resting-paw { transform-origin: 397px 352px; }
            #ear-left-group { transform-origin: 250px 135px; }
            #ear-right-group { transform-origin: 420px 150px; }
            .jiwoo-eye {
              transform-origin: 0px 0px;
              animation: jiwoo-blink 4.2s infinite;
            }

            /* 1. MODE MENYAPA (GREETING) */
            .state-greeting #waving-arm {
              animation: jiwoo-wave-hello 2.2s ease-in-out infinite;
            }
            .state-greeting #cat-head-group {
              animation: jiwoo-head-greeting 3.6s ease-in-out infinite;
            }
            .state-greeting #resting-paw {
              animation: jiwoo-paw-tap-idle 4s ease-in-out infinite;
            }

            /* 2. MODE MENYIMAK (LISTENING) */
            .state-listening #cat-head-group {
              animation: jiwoo-head-nod-listen 1.4s ease-in-out infinite;
            }
            .state-listening #waving-arm {
              animation: jiwoo-arm-calm-listen 2.2s ease-in-out infinite;
            }
            .state-listening #ear-left-group {
              animation: jiwoo-ear-twitch-left 1.1s ease-in-out infinite;
            }
            .state-listening #ear-right-group {
              animation: jiwoo-ear-twitch-right 1.1s ease-in-out infinite;
            }
            .state-listening #resting-paw {
              animation: jiwoo-paw-tap-idle 2.2s ease-in-out infinite;
            }

            /* 3. MODE BERPIKIR (THINKING) */
            .state-thinking #cat-head-group {
              animation: jiwoo-head-thinking 1.2s ease-in-out infinite;
            }
            .state-thinking #waving-arm {
              animation: jiwoo-arm-thinking 1.2s ease-in-out infinite;
            }
            .state-thinking #resting-paw {
              animation: jiwoo-paw-tap-fast 0.5s ease-in-out infinite;
            }

            /* 4. MODE MENJELASKAN / BERBICARA (EXPLAINING) */
            .state-explaining #cat-head-group {
              animation: jiwoo-head-explain 0.65s ease-in-out infinite;
            }
            .state-explaining #waving-arm {
              animation: jiwoo-arm-gesture-explain 0.55s ease-in-out infinite;
            }
            .state-explaining #resting-paw {
              animation: jiwoo-paw-explain 0.75s ease-in-out infinite;
            }
            .state-explaining #ear-left-group {
              animation: jiwoo-ear-twitch-left 0.9s ease-in-out infinite;
            }
            .state-explaining #ear-right-group {
              animation: jiwoo-ear-twitch-right 0.9s ease-in-out infinite;
            }
            .state-explaining #talking-mouth {
              transform-origin: 298px 252px;
              animation: jiwoo-mouth-talk 0.19s ease-in-out infinite alternate;
            }

            @keyframes jiwoo-blink {
              0%, 44%, 48%, 94%, 98%, 100% { transform: scaleY(1); }
              46%, 96% { transform: scaleY(0.08); }
            }

            @keyframes jiwoo-wave-hello {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(12deg); }
              50% { transform: rotate(-6deg); }
              75% { transform: rotate(10deg); }
            }
            @keyframes jiwoo-head-greeting {
              0%, 100% { transform: rotate(0deg) translateY(0px); }
              50% { transform: rotate(2.5deg) translateY(3px); }
            }
            @keyframes jiwoo-paw-tap-idle {
              0%, 82%, 92%, 100% { transform: translateY(0px) scaleY(1); }
              87% { transform: translateY(-4px) scaleY(1.04); }
            }

            @keyframes jiwoo-head-nod-listen {
              0%, 100% { transform: rotate(-3deg) translateY(2px) scale(1.03); }
              50% { transform: rotate(1deg) translateY(9px) scale(1.04); }
            }
            @keyframes jiwoo-arm-calm-listen {
              0%, 100% { transform: rotate(-10deg) translateY(14px); }
              50% { transform: rotate(-7deg) translateY(18px); }
            }
            @keyframes jiwoo-ear-twitch-left {
              0%, 100% { transform: rotate(0deg); }
              35% { transform: rotate(-7deg) scale(1.04); }
              70% { transform: rotate(3deg); }
            }
            @keyframes jiwoo-ear-twitch-right {
              0%, 100% { transform: rotate(0deg); }
              45% { transform: rotate(8deg) scale(1.04); }
              80% { transform: rotate(-3deg); }
            }

            @keyframes jiwoo-head-thinking {
              0%, 100% { transform: rotate(-6deg) translateY(-2px); }
              50% { transform: rotate(6deg) translateY(3px); }
            }
            @keyframes jiwoo-arm-thinking {
              0%, 100% { transform: rotate(14deg) translateY(5px); }
              50% { transform: rotate(20deg) translateY(2px); }
            }
            @keyframes jiwoo-paw-tap-fast {
              0%, 100% { transform: translateY(0px) scaleY(1); }
              50% { transform: translateY(-7px) scaleY(1.07); }
            }

            /* Gerakan Ekspresif Saat Jiwoo Berbicara / Menjelaskan */
            @keyframes jiwoo-head-explain {
              0%, 100% { transform: rotate(-3.5deg) translateY(0px) scale(1); }
              50% { transform: rotate(4.5deg) translateY(-7px) scale(1.03); }
            }
            @keyframes jiwoo-arm-gesture-explain {
              0%, 100% { transform: rotate(-8deg) translateY(4px); }
              50% { transform: rotate(18deg) translateY(-10px) scale(1.05); }
            }
            @keyframes jiwoo-paw-explain {
              0%, 100% { transform: translateY(0px) scaleY(1); }
              50% { transform: translateY(-8px) scaleY(1.08) rotate(-4deg); }
            }
            @keyframes jiwoo-mouth-talk {
              0% { transform: scaleY(0.2) scaleX(0.88); }
              100% { transform: scaleY(1.35) scaleX(1.12); }
            }
          `}</style>

          <clipPath id="above-line-clip-interactive">
            <rect x="0" y="0" width="600" height="352" />
          </clipPath>

          <clipPath id="head-shape-clip-interactive">
            <path d="M 218 153 C 217 125, 220 98, 225 90 C 231 82, 260 95, 286 113 C 320 109, 360 116, 388 131 C 417 119, 448 112, 456 121 C 464 130, 464 162, 459 192 C 478 232, 474 288, 441 320 L 442 375 L 185 375 L 186 245 C 188 205, 200 175, 218 153 Z" />
          </clipPath>

          <clipPath id="waving-paw-clip-interactive">
            <path d="M 148 375 L 152 352 L 160 328 C 155 292, 146 255, 149 235 C 153 211, 184 203, 204 218 C 217 228, 222 252, 236 289 L 255 352 L 260 375 Z" />
          </clipPath>
        </defs>

        <g clipPath="url(#above-line-clip-interactive)">
          <g id="cat-head-group">
            <g clipPath="url(#head-shape-clip-interactive)">
              <rect
                id="svg-fur-main"
                x="150"
                y="70"
                width="350"
                height="315"
                fill="#fca95d"
              />
              <path
                id="svg-fur-cream"
                d="M 180 218 C 212 208, 250 216, 276 220 C 288 182, 297 162, 314 164 C 331 166, 336 188, 342 228 C 374 234, 412 246, 434 278 C 448 298, 450 330, 450 375 L 180 375 Z"
                fill="#ffe0a3"
              />
              <g id="ear-left-group">
                <path
                  id="svg-ear-left"
                  d="M 226 156 C 225 132, 227 109, 232 103 C 237 97, 258 107, 274 120 C 254 130, 238 142, 226 156 Z"
                  fill="#f48c98"
                />
              </g>
              <g id="ear-right-group">
                <path
                  id="svg-ear-right"
                  d="M 397 137 C 418 128, 441 124, 447 131 C 453 138, 452 162, 447 187 C 433 166, 417 149, 397 137 Z"
                  fill="#f48c98"
                />
              </g>
              <g id="svg-head-stripes" fill="#94622b">
                <path d="M 299 108 C 294 126, 290 140, 293 142 C 297 143, 304 128, 309 109 Z" />
                <path d="M 318 109 C 310 138, 306 160, 310 162 C 315 163, 325 140, 332 111 Z" />
                <path d="M 342 113 C 335 135, 331 151, 335 153 C 339 154, 347 138, 353 116 Z" />
                <path d="M 196 180 C 207 184, 215 190, 214 194 C 212 197, 203 193, 192 187 Z" />
                <path d="M 189 197 C 200 201, 207 205, 206 209 C 204 212, 196 209, 186 204 Z" />
                <path d="M 472 218 C 452 225, 436 229, 435 225 C 434 221, 450 214, 470 207 Z" />
                <path d="M 474 235 C 452 240, 435 240, 435 236 C 435 232, 452 229, 473 225 Z" />
              </g>
            </g>

            <g
              id="svg-head-outlines"
              fill="none"
              stroke="#593427"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 192 214 C 199 189, 207 170, 218 153 C 217 125, 220 98, 225 90 C 231 82, 260 95, 286 113 C 320 109, 360 116, 388 131 C 417 119, 448 112, 456 121 C 464 130, 464 162, 459 192 C 478 232, 474 288, 441 320 L 442 365" />
              <path d="M 218 153 C 236 135, 258 121, 286 113" />
              <path d="M 388 131 C 394 134, 399 137, 403 140" />
            </g>

            <g id="cat-face-features">
              <g transform="translate(251, 201) rotate(8)">
                <g className="jiwoo-eye">
                  <ellipse
                    cx="0"
                    cy="0"
                    rx={mode === "listening" ? "16.8" : "15.5"}
                    ry={mode === "listening" ? "16" : "14.5"}
                    fill="#593427"
                  />
                  <circle
                    cx={mode === "thinking" ? "-2" : "-5.5"}
                    cy={mode === "thinking" ? "-7" : "-4.5"}
                    r={mode === "listening" ? "5" : "4.2"}
                    fill="#FFFFFF"
                  />
                  {(mode === "listening" || mode === "explaining") && (
                    <circle cx="4.5" cy="4" r="2.2" fill="#FFFFFF" />
                  )}
                </g>
              </g>

              <g transform="translate(356, 218) rotate(8)">
                <g className="jiwoo-eye">
                  <ellipse
                    cx="0"
                    cy="0"
                    rx={mode === "listening" ? "16.8" : "15.5"}
                    ry={mode === "listening" ? "16" : "14.5"}
                    fill="#593427"
                  />
                  <circle
                    cx={mode === "thinking" ? "-2" : "-5.5"}
                    cy={mode === "thinking" ? "-7" : "-4.5"}
                    r={mode === "listening" ? "5" : "4.2"}
                    fill="#FFFFFF"
                  />
                  {(mode === "listening" || mode === "explaining") && (
                    <circle cx="4.5" cy="4" r="2.2" fill="#FFFFFF" />
                  )}
                </g>
              </g>

              <ellipse
                cx="232"
                cy="228"
                rx="14"
                ry="7.5"
                fill="#f48c98"
                opacity={
                  mode === "listening" || mode === "explaining" ? "0.7" : "0.45"
                }
                transform="rotate(6 232 228)"
              />
              <ellipse
                cx="372"
                cy="246"
                rx="14"
                ry="7.5"
                fill="#f48c98"
                opacity={
                  mode === "listening" || mode === "explaining" ? "0.7" : "0.45"
                }
                transform="rotate(6 372 246)"
              />

              <path
                d="M 290 225 C 296 222, 307 224, 311 229 C 314 233, 305 242, 299 242 C 293 241, 286 229, 290 225 Z"
                fill="#593427"
              />
              <path
                d="M 299 239 L 296 250"
                fill="none"
                stroke="#593427"
                strokeWidth="6"
                strokeLinecap="round"
              />

              <path
                d="M 268 245 C 277 254, 291 255, 296 249"
                fill="none"
                stroke="#593427"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M 296 249 C 301 256, 317 259, 329 253"
                fill="none"
                stroke="#593427"
                strokeWidth="6"
                strokeLinecap="round"
              />

              {/* Mulut Terbuka & Bergerak Aktif Saat Mode Explaining (Berbicara) */}
              {mode === "explaining" && (
                <g id="talking-mouth">
                  <path
                    d="M 279 249 C 279 276, 317 278, 318 251 Z"
                    fill="#d95b66"
                    stroke="#593427"
                    strokeWidth="5.5"
                    strokeLinejoin="round"
                  />
                  <ellipse cx="298" cy="264" rx="10" ry="5.5" fill="#f48c98" />
                </g>
              )}

              {mode === "listening" && (
                <ellipse cx="297" cy="256" rx="5.5" ry="4" fill="#593427" />
              )}
            </g>
          </g>

          <g id="waving-arm">
            <g clipPath="url(#waving-paw-clip-interactive)">
              <rect
                x="135"
                y="195"
                width="135"
                height="185"
                fill="#fca95d"
              />
              <g fill="#94622b">
                <path d="M 150 289 C 165 285, 179 286, 179 291 C 179 296, 166 299, 151 301 Z" />
                <path d="M 153 312 C 164 306, 174 306, 175 310 C 176 314, 166 320, 155 323 Z" />
                <path d="M 230 272 C 221 274, 215 277, 216 281 C 217 284, 224 282, 233 279 Z" />
                <path d="M 236 289 C 224 291, 216 294, 217 298 C 218 302, 227 300, 239 296 Z" />
              </g>
              <g fill="#f48c98">
                <ellipse
                  cx="184"
                  cy="259"
                  rx="14.5"
                  ry="10.5"
                  transform="rotate(-8 184 259)"
                />
                <ellipse
                  cx="161"
                  cy="246"
                  rx="4.8"
                  ry="6.8"
                  transform="rotate(-24 161 246)"
                />
                <ellipse
                  cx="173"
                  cy="233"
                  rx="5"
                  ry="7.2"
                  transform="rotate(-10 173 233)"
                />
                <ellipse
                  cx="189"
                  cy="232"
                  rx="5"
                  ry="7.2"
                  transform="rotate(6 189 232)"
                />
                <ellipse
                  cx="203"
                  cy="242"
                  rx="4.8"
                  ry="6.8"
                  transform="rotate(22 203 242)"
                />
              </g>
            </g>
            <path
              d="M 148 372 L 152 352 L 160 328 C 155 292, 146 255, 149 235 C 153 211, 184 203, 204 218 C 217 228, 222 252, 236 289 L 255 352"
              fill="none"
              stroke="#593427"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        <line
          x1="94"
          y1="352"
          x2="518"
          y2="352"
          stroke="#593427"
          strokeWidth="6.5"
          strokeLinecap="round"
        />

        <g id="resting-paw">
          <path
            d="M 366 352 C 356 332, 366 309, 395 309 C 424 309,434 330, 429 352 Z"
            fill="#fca95d"
          />
          <path
            d="M 430 330 C 438 336, 441 344, 442 352 L 427 352 Z"
            fill="#fca95d"
          />
          <path
            d="M 366 352 C 356 332, 366 309, 395 309 C 424 309,434 330, 429 352 C 418 356, 377 356, 366 352 Z"
            fill="#fca95d"
            stroke="#593427"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 432 325 C 438 334, 441 343, 442 352"
            fill="#fca95d"
            stroke="#593427"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            d="M 380 353 C 378 345, 378 338, 380 334"
            fill="#fca95d"
            stroke="#593427"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 397 354 C 396 344, 396 336, 397 331"
            fill="#fca95d"
            stroke="#593427"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 414 353 C 414 345, 413 338, 412 334"
            fill="#fca95d"
            stroke="#593427"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}