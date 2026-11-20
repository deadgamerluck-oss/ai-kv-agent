import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Headphones } from 'lucide-react';

export interface AIAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  isListening?: boolean;
  mode?: 'chat' | 'voice';
  className?: string;
}

export const AIAvatar: React.FC<AIAvatarProps> = ({
  size = 'md',
  isSpeaking = false,
  isListening = false,
  mode = 'chat',
  className
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-32 h-32 text-3xl'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
    xl: 'w-16 h-16'
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center flex-shrink-0', className)}>
      {/* Speaking/listening glow pulse rings */}
      {(isSpeaking || isListening) && (
        <span 
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-30',
            isSpeaking ? 'bg-secondary-400' : 'bg-primary-400'
          )}
        />
      )}
      {(isSpeaking || isListening) && (
        <span 
          className={cn(
            'absolute -inset-2 rounded-full animate-pulse-ring opacity-40',
            isSpeaking ? 'bg-primary-500' : 'bg-secondary-300'
          )}
        />
      )}

      {/* Avatar core container */}
      <div
        className={cn(
          'relative rounded-full flex items-center justify-center font-semibold text-white shadow-md transition-all duration-300',
          sizeClasses[size],
          isSpeaking 
            ? 'bg-gradient-to-tr from-primary-700 via-primary-500 to-secondary-400 ring-4 ring-primary-100' 
            : isListening
            ? 'bg-gradient-to-tr from-primary-700 to-primary-400 ring-4 ring-primary-100'
            : 'bg-gradient-to-tr from-primary-700 to-primary-400'
        )}
      >
        {mode === 'voice' ? (
          <Headphones className={iconSizes[size]} />
        ) : (
          <span className="font-bold tracking-tight" aria-label="Khushi">K</span>
        )}

        {/* Small sparkle badge for active status */}
        <span className="absolute -bottom-0.5 -right-0.5 bg-white p-0.5 rounded-full shadow-sm">
          <Sparkles className="w-2.5 h-2.5 text-secondary-600 fill-secondary-400" />
        </span>
      </div>
    </div>
  );
};
