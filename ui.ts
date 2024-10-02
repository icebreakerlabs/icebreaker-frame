import { createSystem } from 'frog/ui';
import { lucide } from 'frog/ui/icons';

export const {
  Box,
  Columns,
  Column,
  Heading,
  Image,
  HStack,
  Rows,
  Row,
  Spacer,
  Text,
  VStack,
  vars,
} = createSystem({
  colors: {
    text: '#EDEEF0',
    background: '#111113',
    blue: '#0070f3',
    green: '#00ff00',
    red: '#ff0000',
    orange: '#ffaa00',
    muted: '#B0B4BA',
  },
  icons: lucide,
});