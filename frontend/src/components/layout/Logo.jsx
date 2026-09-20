import logo from '../../assets/logo.png';

/** Logo Zaya (signature crème sur fond rouge), recadré depuis assets/images/5.png. */
export function Logo({ className = '' }) {
  return <img className={`logo__image ${className}`} src={logo} alt="Zaya" />;
}
