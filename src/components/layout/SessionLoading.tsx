import { LoadingRegion, Skeleton } from '../ui/States';
import { FullScreen } from './Layouts';

/** Full-screen loading state (checking the session, opening the data source). */
export function SessionLoading() {
  return (
    <FullScreen>
      <div className="px-4 pt-6">
        <LoadingRegion>
          <Skeleton className="h-56" />
          <Skeleton className="h-40" />
        </LoadingRegion>
      </div>
    </FullScreen>
  );
}
