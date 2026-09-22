import React from 'react';
import {Animated, Image, ImageSourcePropType, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Fonts} from '../theme/fonts';

export const FOR_ME_DAY_GOSPEL = 'God loves us, but sin separates us from Him. Jesus died for our sins and rose again so we could be forgiven and have new life.\n\nSalvation is God’s gift of grace, received through faith. Turn to Jesus and trust in Him.\n\nThis good news is for you, too.';

export interface ForMeDayShareData {
  title: string;
  occasion: string;
  date: string;
}

export const getForMeDayShareText = (data: ForMeDayShareData) =>
  `${data.title.replace(/\n/g, ' ')}\n\n${data.occasion}\n\n${FOR_ME_DAY_GOSPEL}\n\nThe day my journey began: ${data.date}\nJournal by siFia`;

export type MilestoneLayout = 'keepsake' | 'minimal' | 'celebration';
export const MILESTONE_LAYOUTS: Array<{id: MilestoneLayout; label: string}> = [
  {id: 'keepsake', label: 'Keepsake'},
  {id: 'minimal', label: 'Minimal'},
  {id: 'celebration', label: 'Celebration'},
];

export interface MilestonePalette {
  id: string;
  label: string;
  background: string;
  glow: string;
  foreground: string;
  muted: string;
  accent: string;
  border: string;
}

export const MILESTONE_PALETTES: MilestonePalette[] = [
  {id: 'ivory', label: 'Ivory', background: '#F7F2E8', glow: '#E6D8BA', foreground: '#2C443A', muted: '#52675C', accent: '#786440', border: '#D9CBAF'},
  {id: 'sage', label: 'Sage', background: '#344F43', glow: '#59745D', foreground: '#FFF7E8', muted: '#E0E9DB', accent: '#E6C991', border: '#8A9B7A'},
  {id: 'midnight', label: 'Midnight', background: '#182C43', glow: '#395675', foreground: '#FFF7E8', muted: '#DDE4EF', accent: '#E6C991', border: '#6A7C91'},
  {id: 'rose', label: 'Rose', background: '#F4E6E1', glow: '#E8C8BC', foreground: '#563B40', muted: '#72545A', accent: '#805743', border: '#CFB3A8'},
  {id: 'lavender', label: 'Lavender', background: '#EEE9F5', glow: '#D9CDEB', foreground: '#413852', muted: '#665773', accent: '#765B43', border: '#C8BAD5'},
  {id: 'terracotta', label: 'Terracotta', background: '#864C3D', glow: '#A7664A', foreground: '#FFF6E7', muted: '#F5E1D7', accent: '#F5D7A2', border: '#C99E80'},
];

interface Props {
  data: ForMeDayShareData;
  width: number;
  height?: number;
  palette?: MilestonePalette;
  image?: ImageSourcePropType;
  layout?: MilestoneLayout;
  showBranding?: boolean;
  titleFont?: string;
  bodyFont?: string;
  titleScale?: Animated.Value;
  textAlign?: 'left' | 'center' | 'right';
}

const ForMeDayShareCard = ({
  data, width, height = width * 1.25, palette = MILESTONE_PALETTES[0], image,
  layout = 'keepsake', showBranding = true, titleFont = Fonts.lora.medium,
  bodyFont = Fonts.lora.regular, titleScale, textAlign = 'center',
}: Props) => {
  const scale = width / 300;
  const ink = image ? '#FFF7E8' : palette.foreground;
  const muted = image ? '#F3EEE4' : palette.muted;
  const accent = image ? '#F1D8A6' : palette.accent;
  const border = image ? 'rgba(255,247,232,0.45)' : palette.border;
  const minimal = layout === 'minimal';
  const titleSize = 22 * scale;
  const titleLine = 27 * scale;
  const labelStyle = {fontFamily: Fonts.semiBold, color: accent, fontSize: 7 * scale, lineHeight: 11 * scale, letterSpacing: 1.2 * scale};

  return (
    <View accessibilityLabel="For Me Day share card" style={{width, height, backgroundColor: palette.background, overflow: 'hidden'}}>
      {image ? <>
        <Image source={image} resizeMode="cover" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(12,22,20,0.68)'}]} />
      </> : layout === 'celebration' ? (
        <LinearGradient colors={[palette.background, palette.glow, palette.background]} style={StyleSheet.absoluteFill} />
      ) : null}
      {!minimal && <View pointerEvents="none" style={{position: 'absolute', top: 8 * scale, bottom: 8 * scale, left: 8 * scale, right: 8 * scale, borderWidth: 1, borderColor: border, borderRadius: layout === 'keepsake' ? 12 * scale : 0}} />}
      <View style={{flex: 1, padding: 20 * scale, justifyContent: 'space-between'}}>
        <View style={styles.row}>
          <Text allowFontScaling={false} style={labelStyle}>MY FOR ME DAY</Text>
          <Text allowFontScaling={false} style={[labelStyle, {fontSize: 12 * scale}]}>{layout === 'celebration' ? '✦' : '✧'}</Text>
        </View>
        <View style={{alignItems: 'center', height: 30 * scale, justifyContent: 'center'}} accessible={false}>
          {!minimal && <View style={{position: 'absolute', width: 32 * scale, height: 30 * scale, borderTopLeftRadius: 18 * scale, borderTopRightRadius: 18 * scale, borderWidth: 1, borderBottomWidth: 0, borderColor: border}} />}
          <View style={{width: 1.5 * scale, height: 21 * scale, backgroundColor: accent}} />
          <View style={{position: 'absolute', top: 12 * scale, width: 14 * scale, height: 1.5 * scale, backgroundColor: accent}} />
        </View>
        <Text allowFontScaling={false} style={[labelStyle, {textAlign}]}>{data.occasion}</Text>
        <Animated.Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} style={{fontFamily: titleFont, color: ink, textAlign, fontSize: titleScale ? Animated.multiply(titleScale, titleSize) : titleSize, lineHeight: titleScale ? Animated.multiply(titleScale, titleLine) : titleLine}}>{data.title}</Animated.Text>
        <View style={{alignSelf: 'center', width: 28 * scale, height: 1, backgroundColor: border}} />
        <Text allowFontScaling={false} style={{fontFamily: bodyFont, fontSize: 10 * scale, lineHeight: 14 * scale, color: muted, textAlign}}>{FOR_ME_DAY_GOSPEL}</Text>
        <View style={{alignItems: 'center'}}>
          <Text allowFontScaling={false} style={[labelStyle, {fontSize: 6 * scale}]}>THE DAY MY JOURNEY BEGAN</Text>
          <Text allowFontScaling={false} style={{fontFamily: Fonts.lora.medium, fontSize: 14 * scale, lineHeight: 20 * scale, color: ink}}>{data.date}</Text>
        </View>
        {showBranding && <View style={styles.row}>
          <Image accessibilityLabel="Journal by siFia app icon" source={require('../../assets/images/journalbysifia-app-icon.png')} resizeMode="cover" style={{width: 24 * scale, height: 24 * scale, borderRadius: 5 * scale}} />
          <Text allowFontScaling={false} style={{fontFamily: Fonts.regular, fontSize: 8 * scale, color: muted}}>Journal by siFia</Text>
        </View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}});

export default ForMeDayShareCard;
