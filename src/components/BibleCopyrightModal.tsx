import React from 'react';
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import ThemedText from './common/ThemedText';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import { triggerLightHaptic } from '../utils/haptics';

interface BibleCopyrightModalProps {
  visible: boolean;
  onClose: () => void;
  bibleVersion: string;
  contained?: boolean;
}

const getBibleCopyrightInfo = (version: string) => {
  const copyrights: { [key: string]: { name: string; copyright: string; publisher: string } } = {
    'AMP': {
      name: 'Amplified Bible',
      copyright: 'Copyright © 2015 by The Lockman Foundation, La Habra, CA 90631. All rights reserved.',
      publisher: 'The Lockman Foundation',
    },
    'NASB': {
      name: 'New American Standard Bible',
      copyright: 'Scripture quotations taken from the New American Standard Bible® (NASB), Copyright © 1960, 1962, 1963, 1968, 1971, 1972, 1973, 1975, 1977, 1995 by The Lockman Foundation. Used by permission. www.Lockman.org',
      publisher: 'The Lockman Foundation',
    },
    'ESV': {
      name: 'English Standard Version',
      copyright: 'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.',
      publisher: 'Crossway',
    },
    'NIV': {
      name: 'New International Version',
      copyright: 'Scripture quotations taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission of Zondervan. All rights reserved worldwide.',
      publisher: 'Zondervan',
    },
    'NLT': {
      name: 'New Living Translation',
      copyright: 'Scripture quotations are taken from the Holy Bible, New Living Translation, copyright ©1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.',
      publisher: 'Tyndale House Publishers',
    },
    'NKJV': {
      name: 'New King James Version',
      copyright: 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.',
      publisher: 'Thomas Nelson',
    },
    'CSB': {
      name: 'Christian Standard Bible',
      copyright: 'Scripture quotations marked CSB have been taken from the Christian Standard Bible®, Copyright © 2017 by Holman Bible Publishers. Used by permission. Christian Standard Bible® and CSB® are federally registered trademarks of Holman Bible Publishers.',
      publisher: 'Holman Bible Publishers',
    },
    'MSG': {
      name: 'The Message',
      copyright: 'Copyright © 1993, 2002, 2018 by Eugene H. Peterson',
      publisher: 'Eugene H. Peterson',
    },
  };

  return copyrights[version] || {
    name: version,
    copyright: `Scripture quotations are from the ${version} Bible translation.`,
    publisher: 'Publisher information not available',
  };
};

export const BibleCopyrightModal: React.FC<BibleCopyrightModalProps> = ({
  visible,
  onClose,
  bibleVersion,
  contained = false,
}) => {
  const copyrightInfo = getBibleCopyrightInfo(bibleVersion);
  if (!visible) { return null; }

  const content = (
    <View style={[styles.modalContainer, { backgroundColor: Colors.sage }]}>
      <View style={styles.header}>
        <ThemedText weight="semiBold" style={[styles.title, { color: Colors.hopeWhite }]}>
          Bible Translation Information
        </ThemedText>
        <TouchableOpacity onPress={() => {
          triggerLightHaptic();
          onClose();
        }} style={styles.closeButton}>
          <Ionicons
            name="close"
            size={24}
            color={Colors.hopeWhite}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <ThemedText weight="medium" style={[styles.versionName, { color: Colors.hopeWhite }]}>
          {copyrightInfo.name} ({bibleVersion})
        </ThemedText>

        <ThemedText style={[styles.publisher, { color: Colors.hopeWhite }]}>
          Publisher: {copyrightInfo.publisher}
        </ThemedText>

        <ThemedText style={[styles.copyrightText, { color: Colors.hopeWhite }]}>
          {copyrightInfo.copyright}
        </ThemedText>
      </ScrollView>
    </View>
  );

  if (contained) {
    return <View style={[styles.overlay, styles.containedOverlay]}>{content}</View>;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>{content}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  containedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 30,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  versionName: {
    fontSize: 16,
    marginBottom: 8,
  },
  publisher: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  copyrightText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.9,
  },
});
