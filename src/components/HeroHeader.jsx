import React from "react";

export default function HeroHeader({ title, subtitle, image }) {

  const heroStyle = image
    ? { backgroundImage: `url(${image})` }
    : {};

  return (
    <div className="hero-header" style={heroStyle}>
      <div className="hero-overlay">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}