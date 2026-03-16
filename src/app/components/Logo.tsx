import React from "react";

interface LogoProps {
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <div className={`bg-[#050505] flex items-center justify-center rounded-lg ${className || ""}`}>
            <span className="font-display text-xs text-white">RN</span>
        </div>
    );
};
