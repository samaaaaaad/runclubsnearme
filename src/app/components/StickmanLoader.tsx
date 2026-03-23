"use client";

type StickmanLoaderProps = {
    label?: string;
};

export function StickmanLoader({ label = "Loading" }: StickmanLoaderProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
            <div className="text-center">
                <div className="runner-stage mx-auto mb-4">
                    <div className="track" />
                    <div className="runner" aria-hidden>
                        <span className="head" />
                        <span className="torso" />
                        <span className="hip" />
                        <span className="arm arm-back" />
                        <span className="arm arm-front" />
                        <span className="leg leg-back" />
                        <span className="leg leg-front" />
                    </div>
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-700">{label}</p>
            </div>

            <style jsx>{`
        .runner-stage {
          position: relative;
          width: 200px;
          height: 98px;
        }

        .track {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 8px;
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, #d1d5db 0%, #4b5563 50%, #d1d5db 100%);
          background-size: 200% 100%;
          animation: track-slide 0.55s linear infinite;
        }

        .runner {
          position: absolute;
          left: 80px;
          bottom: 12px;
          width: 60px;
          height: 74px;
          animation: runner-sprint 0.26s cubic-bezier(0.5, 0, 0.45, 1) infinite;
        }

        .runner span {
          position: absolute;
          display: block;
          background: #111827;
          transform-origin: top center;
        }

        .head {
          width: 11px;
          height: 11px;
          border-radius: 999px;
          left: 31px;
          top: 0;
          z-index: 4;
        }

        .torso {
          width: 8px;
          height: 29px;
          border-radius: 8px;
          left: 32px;
          top: 11px;
          transform: rotate(8deg);
          z-index: 3;
        }

        .hip {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          left: 31px;
          top: 37px;
          z-index: 4;
        }

        .arm {
          width: 4px;
          height: 23px;
          border-radius: 999px;
          left: 34px;
          top: 14px;
          transform-origin: 2px 2px;
        }

        .arm-front {
          z-index: 5;
          animation: arm-front 0.26s cubic-bezier(0.5, 0, 0.45, 1) infinite;
        }

        .arm-back {
          z-index: 2;
          animation: arm-back 0.26s cubic-bezier(0.5, 0, 0.45, 1) infinite;
        }

        .leg {
          width: 5px;
          height: 30px;
          border-radius: 999px;
          left: 33px;
          top: 40px;
          transform-origin: 2px 1px;
        }

        .leg-front {
          z-index: 4;
          animation: leg-front 0.26s cubic-bezier(0.5, 0, 0.45, 1) infinite;
        }

        .leg-back {
          z-index: 1;
          animation: leg-back 0.26s cubic-bezier(0.5, 0, 0.45, 1) infinite;
        }


        @keyframes runner-sprint {
          0%,
          100% {
            transform: translateY(0) translateX(-1px) rotate(14deg);
          }
          50% {
            transform: translateY(-2px) translateX(1px) rotate(14deg);
          }
        }

        @keyframes arm-front {
          0%,
          100% {
            transform: rotate(55deg);
          }
          50% {
            transform: rotate(-68deg);
          }
        }

        @keyframes arm-back {
          0%,
          100% {
            transform: rotate(-68deg);
          }
          50% {
            transform: rotate(55deg);
          }
        }

        @keyframes leg-front {
          0%,
          100% {
            transform: rotate(62deg);
          }
          50% {
            transform: rotate(-48deg);
          }
        }

        @keyframes leg-back {
          0%,
          100% {
            transform: rotate(-48deg);
          }
          50% {
            transform: rotate(62deg);
          }
        }

        @keyframes track-slide {
          0% {
            background-position: 0% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

      `}</style>
        </div>
    );
}
