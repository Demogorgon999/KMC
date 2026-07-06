/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface KMCLogoProps {
  className?: string;
  hideText?: boolean;
  companyInitials?: string;
  companySubtitle?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

export default function KMCLogo({ 
  className = 'h-10', 
  hideText = false,
  companyInitials = 'KMC',
  companySubtitle = 'CONSTRUCTION',
  primaryColor = '#E5B830',
  secondaryColor = '#138A8E',
  logoUrl
}: KMCLogoProps) {
  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {logoUrl ? (
        <motion.img 
          src={logoUrl} 
          alt={`${companyInitials} logo`} 
          className="h-full w-auto object-contain shrink-0 max-h-12 max-w-[64px] rounded-lg border border-zinc-800" 
          referrerPolicy="no-referrer"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
        />
      ) : (
        <motion.svg
          viewBox="0 0 100 100"
          className="h-full w-auto drop-shadow-[0_4px_12px_rgba(229,184,48,0.15)] shrink-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          whileHover="hover"
          initial="initial"
        >
          {/* Left Vertical column (Stem of absolute grid height y: 15 to 85) */}
          <motion.polygon 
            points="20,15 48,50 20,58" 
            fill="#2B3452" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            variants={{
              initial: { x: 0, y: 0 },
              hover: { x: -2, y: -2, fill: '#3E4973' }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />
          <motion.polygon 
            points="20,58 48,50 20,93" 
            fill={primaryColor} 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            variants={{
              initial: { x: 0, y: 0 },
              hover: { x: -3, y: 2, filter: 'brightness(1.15)' }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />

          {/* Right Arm: Upper */}
          <motion.polygon 
            points="48,34 84,15 84,46" 
            fill={primaryColor} 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            variants={{
              initial: { x: 0, y: 0 },
              hover: { x: 3, y: -2, filter: 'brightness(1.15)' }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />

          {/* Right Arm: Secondary Upper */}
          <motion.polygon 
            points="48,34 84,46 66,54" 
            fill={secondaryColor} 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            variants={{
              initial: { x: 0, y: 0 },
              hover: { x: 2, y: -1, fill: '#16A2A7' }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />

          {/* Right Arm: Secondary Lower */}
          <motion.polygon 
            points="48,50 66,54 84,72" 
            fill="#2B3452" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            variants={{
              initial: { x: 0, y: 0 },
              hover: { x: 1, y: 1 }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />

          {/* Right Arm: Bottom */}
          <motion.polygon 
            points="48,50 84,72 84,103" 
            fill="#7C7D6E" 
            stroke="#111111" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            variants={{
              initial: { x: 0, y: 0 },
              hover: { x: 3, y: 3, fill: '#949586' }
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />
        </motion.svg>
      )}

      {/* Corporate Typographical Mark */}
      {!hideText && (
        <div className="flex flex-col justify-center leading-none">
          <motion.span 
            className="font-sans font-extrabold text-[#F3F4F6] text-lg tracking-wide uppercase"
            animate={{ letterSpacing: '0.05em' }}
            whileHover={{ letterSpacing: '0.1em', color: primaryColor }}
            transition={{ duration: 0.3 }}
          >
            {companyInitials}
          </motion.span>
          <span className="font-sans font-light text-[#A1A1AA] text-[10px] tracking-[0.24em] uppercase mt-0.5">
            {companySubtitle}
          </span>
        </div>
      )}
    </div>
  );
}
