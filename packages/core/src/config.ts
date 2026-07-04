export const CRITERIA = {
  city: "enschede",
  minPrice: 500,
  maxPrice: 950,
  moveInDeadline: "2026-08-17",
  acceptedTypes: ["studio", "apartment", "room-private-bath"] as const,
  highPriorityScore: 70,
} as const;

// Campus scoring zones (keywords matched case-insensitively against area/postalcode)
export const CAMPUS_ZONES = {
  onCampus: ["drienerlolaan", "calslaan", "witbreuksweg", "matenweg", "campuslaan", "de hems", "bosweg", "campus", " ut ", "7522"],
  nearCampus: ["hengelosestraat", "roombeek", "twekkelerveld", "deppenbroek", "bolhaar", "7523"],
} as const;
