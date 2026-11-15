import { isLandingAddress } from '../../app/navigation';

const root = document.documentElement;

export const onLanding = () => root.classList.contains('landing');
export const leaveLanding = () => root.classList.remove('landing');

export function followLanding(search: string) {
  const landing = isLandingAddress(search);
  root.classList.toggle('landing', landing);
  return landing;
}
