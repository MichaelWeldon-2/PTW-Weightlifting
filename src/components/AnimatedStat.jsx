import { useEffect, useState } from "react";

export default function AnimatedStat({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / (duration / 16);

    const counter = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplay(value);
        clearInterval(counter);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(counter);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}