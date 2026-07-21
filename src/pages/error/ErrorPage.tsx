// pages/error/ErrorPage.tsx
import { useRouteError, isRouteErrorResponse, useRevalidator, useNavigate } from 'react-router';
import { AlertTriangle, FileQuestion } from 'lucide-react';
import { motion } from 'motion/react';
import { NeumorphicCard } from '@/shared/ui/NeumorphicCard';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { transition } from '@/shared/config/motion-tokens';

function getErrorInfo(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        icon: FileQuestion,
        heading: 'Page not found',
        message: 'The page you\u2019re looking for doesn\u2019t exist or has been moved.',
        is404: true,
      };
    }
    return {
      icon: AlertTriangle,
      heading: `Error ${error.status}`,
      message: error.statusText || 'Something went wrong.',
      is404: false,
    };
  }

  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred.';

  return {
    icon: AlertTriangle,
    heading: 'Something went wrong',
    message,
    is404: false,
  };
}

export default function ErrorPage() {
  const error = useRouteError();
  const { revalidate } = useRevalidator();
  const navigate = useNavigate();

  const { icon: Icon, heading, message } = getErrorInfo(error);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.page}
      className="flex flex-col items-center justify-center min-h-[60vh] px-2"
    >
      <NeumorphicCard className="text-center max-w-sm w-full">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
            <Icon size={28} className="text-danger" />
          </div>
          <h2 className="text-xl font-bold text-text-primary m-0 mb-2">
            {heading}
          </h2>
          <p className="text-sm text-text-secondary m-0 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <NeumorphicButton
            variant="primary"
            className="flex-1"
            onClick={() => revalidate()}
          >
            Try again
          </NeumorphicButton>
          <NeumorphicButton
            variant="ghost"
            className="flex-1"
            onClick={() => navigate('/')}
          >
            Go home
          </NeumorphicButton>
        </div>
      </NeumorphicCard>
    </motion.div>
  );
}
