import { avatarSvg } from "../../lib/avatar";
import "./Avatar.css";

type Props = {
  seed: string;
  size?: number;
  className?: string;
};

export function Avatar({ seed, size = 28, className = "" }: Props) {
  return (
    <span
      className={`avatar ${className}`.trim()}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: avatarSvg(seed, size) }}
    />
  );
}
