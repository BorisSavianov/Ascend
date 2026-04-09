import type { ImageRequireSource } from 'react-native';

// Bundled exercise images. Files live in assets/exercises/*.png
// All requires are commented out until images are added to that directory —
// Metro will crash at build time if a required file doesn't exist.
// Uncomment each line when the corresponding asset is available.
// The component falls back to MUSCLE_GROUP_ICONS when the key is absent.
export const EXERCISE_IMAGES: Partial<Record<string, ImageRequireSource>> = {
  // lat_pulldown:              require('../assets/exercises/lat_pulldown.png'),
  // incline_chest_press:       require('../assets/exercises/incline_chest_press.png'),
  // leg_extension:             require('../assets/exercises/leg_extension.png'),
  // seated_row:                require('../assets/exercises/seated_row.png'),
  // seated_chest_fly:          require('../assets/exercises/seated_chest_fly.png'),
  // lying_leg_curl:            require('../assets/exercises/lying_leg_curl.png'),
  // shoulder_press:            require('../assets/exercises/shoulder_press.png'),
  // overhead_triceps_extension: require('../assets/exercises/overhead_triceps_extension.png'),
  // preacher_curl:             require('../assets/exercises/preacher_curl.png'),
  // lateral_raise:             require('../assets/exercises/lateral_raise.png'),
  // tricep_pushdown:           require('../assets/exercises/tricep_pushdown.png'),
  // hammer_curl:               require('../assets/exercises/hammer_curl.png'),
  // hack_squat:                require('../assets/exercises/hack_squat.png'),
  // bayesian_curl:             require('../assets/exercises/bayesian_curl.png'),
  // seated_reverse_fly:        require('../assets/exercises/seated_reverse_fly.png'),
};

// Ionicons fallback icon per muscle group, used when no image is available
export const MUSCLE_GROUP_ICONS: Record<string, string> = {
  back:       'body-outline',
  chest:      'body-outline',
  quads:      'walk-outline',
  hamstrings: 'walk-outline',
  shoulders:  'barbell-outline',
  triceps:    'barbell-outline',
  biceps:     'barbell-outline',
  rear_delts: 'barbell-outline',
};
