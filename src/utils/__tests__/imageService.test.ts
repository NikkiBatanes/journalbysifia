/**
 * imageService.test.ts
 * Test suite for image service utility
 */

// Mock the image service
const imageService = {
  resizeImage: async (imageData: string, width: number, height: number): Promise<string> => {
    // Mock implementation - in real app this would resize image
    return `resized_${width}x${height}_${imageData}`;
  },

  compressImage: async (imageData: string, quality: number = 0.8): Promise<string> => {
    // Mock implementation - in real app this would compress image
    return `compressed_${quality}_${imageData}`;
  },

  cropImage: async (
    imageData: string, 
    x: number, 
    y: number, 
    width: number, 
    height: number
  ): Promise<string> => {
    // Mock implementation - in real app this would crop image
    return `cropped_${x}_${y}_${width}_${height}_${imageData}`;
  },

  rotateImage: async (imageData: string, degrees: number): Promise<string> => {
    // Mock implementation - in real app this would rotate image
    return `rotated_${degrees}_${imageData}`;
  },

  flipImage: async (imageData: string, direction: 'horizontal' | 'vertical'): Promise<string> => {
    // Mock implementation - in real app this would flip image
    return `flipped_${direction}_${imageData}`;
  },

  addWatermark: async (
    imageData: string, 
    watermarkText: string, 
    options?: {
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
      opacity?: number;
      fontSize?: number;
      color?: string;
    }
  ): Promise<string> => {
    const opts = {
      position: 'bottom-right',
      opacity: 0.5,
      fontSize: 16,
      color: '#ffffff',
      ...options
    };
    
    return `watermarked_${watermarkText}_${opts.position}_${opts.opacity}_${imageData}`;
  },

  convertFormat: async (imageData: string, format: 'jpeg' | 'png' | 'webp'): Promise<string> => {
    // Mock implementation - in real app this would convert image format
    return `converted_to_${format}_${imageData}`;
  },

  getImageInfo: async (imageData: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    colorSpace: string;
    hasAlpha: boolean;
  }> => {
    // Mock implementation - in real app this would extract image metadata
    return {
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: imageData.length,
      colorSpace: 'RGB',
      hasAlpha: false
    };
  },

  generateThumbnail: async (
    imageData: string, 
    size: number = 150,
    quality: number = 0.8
  ): Promise<string> => {
    // Mock implementation - in real app this would generate thumbnail
    return `thumbnail_${size}x${size}_q${quality}_${imageData}`;
  },

  applyFilter: async (
    imageData: string, 
    filterType: 'grayscale' | 'sepia' | 'blur' | 'sharpen' | 'brightness' | 'contrast',
    intensity?: number
  ): Promise<string> => {
    const intensityValue = intensity || 1.0;
    return `filtered_${filterType}_${intensityValue}_${imageData}`;
  },

  adjustImageProperties: async (
    imageData: string,
    adjustments: {
      brightness?: number;
      contrast?: number;
      saturation?: number;
      hue?: number;
    }
  ): Promise<string> => {
    const params = Object.entries(adjustments)
      .map(([key, value]) => `${key}_${value}`)
      .join('_');
    
    return `adjusted_${params}_${imageData}`;
  },

  removeBackground: async (imageData: string): Promise<string> => {
    // Mock implementation - in real app this would use AI to remove background
    return `background_removed_${imageData}`;
  },

  detectFaces: async (imageData: string): Promise<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>> => {
    // Mock implementation - in real app this would use face detection
    return [
      { x: 100, y: 100, width: 150, height: 150, confidence: 0.95 },
      { x: 300, y: 200, width: 120, height: 120, confidence: 0.87 }
    ];
  },

  extractColors: async (imageData: string, count: number = 5): Promise<Array<{
    hex: string;
    rgb: { r: number; g: number; b: number };
    percentage: number;
  }>> => {
    // Mock implementation - in real app this would extract dominant colors
    return [
      { hex: '#FF6B6B', rgb: { r: 255, g: 107, b: 107 }, percentage: 35 },
      { hex: '#4ECDC4', rgb: { r: 78, g: 205, b: 196 }, percentage: 25 },
      { hex: '#45B7D1', rgb: { r: 69, g: 183, b: 209 }, percentage: 20 },
      { hex: '#96CEB4', rgb: { r: 150, g: 206, b: 180 }, percentage: 15 },
      { hex: '#FFEAA7', rgb: { r: 255, g: 234, b: 167 }, percentage: 5 }
    ];
  },

  optimizeForWeb: async (imageData: string, options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  }): Promise<{
    optimizedData: string;
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
  }> => {
    const opts = {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8,
      format: 'jpeg' as const,
      ...options
    };

    const originalSize = imageData.length;
    const optimizedSize = Math.floor(originalSize * opts.quality);
    const compressionRatio = originalSize / optimizedSize;

    return {
      optimizedData: `optimized_${opts.format}_${opts.quality}_${imageData}`,
      originalSize,
      optimizedSize,
      compressionRatio
    };
  },

  createCollage: async (
    images: string[],
    layout: 'grid' | 'horizontal' | 'vertical' | 'mosaic',
    options?: {
      spacing?: number;
      backgroundColor?: string;
      borderRadius?: number;
    }
  ): Promise<string> => {
    const opts = {
      spacing: 10,
      backgroundColor: '#ffffff',
      borderRadius: 0,
      ...options
    };

    return `collage_${layout}_${images.length}_images_${imageData}`;
  },

  addFrame: async (
    imageData: string,
    frameOptions: {
      width: number;
      color: string;
      style: 'solid' | 'dashed' | 'double';
    }
  ): Promise<string> => {
    const { width, color, style } = frameOptions;
    return `framed_${width}px_${color}_${style}_${imageData}`;
  }
};

describe('imageService', () => {

  describe('resizeImage', () => {
    it('should resize image successfully', async () => {
      const imageData = 'base64_image_data';
      const width = 800;
      const height = 600;

      const result = await imageService.resizeImage(imageData, width, height);

      expect(result).toBe(`resized_${width}x${height}_${imageData}`);
    });

    it('should handle different dimensions', async () => {
      const imageData = 'base64_image_data';
      const testCases = [
        { width: 100, height: 100 },
        { width: 1920, height: 1080 },
        { width: 500, height: 300 },
        { width: 1024, height: 768 }
      ];

      for (const { width, height } of testCases) {
        const result = await imageService.resizeImage(imageData, width, height);
        expect(result).toBe(`resized_${width}x${height}_${imageData}`);
      }
    });

    it('should handle zero dimensions', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.resizeImage(imageData, 0, 0);
      expect(result).toBe('resized_0x0_base64_image_data');
    });

    it('should handle large dimensions', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.resizeImage(imageData, 10000, 8000);
      expect(result).toBe('resized_10000x8000_base64_image_data');
    });
  });

  describe('compressImage', () => {
    it('should compress image successfully', async () => {
      const imageData = 'base64_image_data';
      const quality = 0.8;

      const result = await imageService.compressImage(imageData, quality);

      expect(result).toBe(`compressed_${quality}_${imageData}`);
    });

    it('should use default quality', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.compressImage(imageData);

      expect(result).toBe(`compressed_0.8_${imageData}`);
    });

    it('should handle different quality values', async () => {
      const imageData = 'base64_image_data';
      const qualities = [0.1, 0.5, 0.8, 0.9, 1.0];

      for (const quality of qualities) {
        const result = await imageService.compressImage(imageData, quality);
        expect(result).toBe(`compressed_${quality}_${imageData}`);
      }
    });

    it('should handle edge quality values', async () => {
      const imageData = 'base64_image_data';
      
      const minQuality = await imageService.compressImage(imageData, 0);
      expect(minQuality).toBe('compressed_0_base64_image_data');

      const maxQuality = await imageService.compressImage(imageData, 1);
      expect(maxQuality).toBe('compressed_1_base64_image_data');
    });
  });

  describe('cropImage', () => {
    it('should crop image successfully', async () => {
      const imageData = 'base64_image_data';
      const x = 100;
      const y = 100;
      const width = 200;
      const height = 200;

      const result = await imageService.cropImage(imageData, x, y, width, height);

      expect(result).toBe(`cropped_${x}_${y}_${width}_${height}_${imageData}`);
    });

    it('should handle different crop parameters', async () => {
      const imageData = 'base64_image_data';
      const testCases = [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 25, width: 300, height: 200 },
        { x: 200, y: 150, width: 400, height: 300 }
      ];

      for (const { x, y, width, height } of testCases) {
        const result = await imageService.cropImage(imageData, x, y, width, height);
        expect(result).toBe(`cropped_${x}_${y}_${width}_${height}_${imageData}`);
      }
    });

    it('should handle zero crop dimensions', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.cropImage(imageData, 0, 0, 0, 0);
      expect(result).toBe('cropped_0_0_0_0_base64_image_data');
    });
  });

  describe('rotateImage', () => {
    it('should rotate image successfully', async () => {
      const imageData = 'base64_image_data';
      const degrees = 90;

      const result = await imageService.rotateImage(imageData, degrees);

      expect(result).toBe(`rotated_${degrees}_${imageData}`);
    });

    it('should handle different rotation angles', async () => {
      const imageData = 'base64_image_data';
      const angles = [0, 45, 90, 180, 270, 360];

      for (const degrees of angles) {
        const result = await imageService.rotateImage(imageData, degrees);
        expect(result).toBe(`rotated_${degrees}_${imageData}`);
      }
    });

    it('should handle negative rotation', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.rotateImage(imageData, -90);
      expect(result).toBe('rotated_-90_base64_image_data');
    });

    it('should handle large rotation values', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.rotateImage(imageData, 720);
      expect(result).toBe('rotated_720_base64_image_data');
    });
  });

  describe('flipImage', () => {
    it('should flip image horizontally', async () => {
      const imageData = 'base64_image_data';
      const direction = 'horizontal' as const;

      const result = await imageService.flipImage(imageData, direction);

      expect(result).toBe(`flipped_${direction}_${imageData}`);
    });

    it('should flip image vertically', async () => {
      const imageData = 'base64_image_data';
      const direction = 'vertical' as const;

      const result = await imageService.flipImage(imageData, direction);

      expect(result).toBe(`flipped_${direction}_${imageData}`);
    });
  });

  describe('addWatermark', () => {
    it('should add watermark with default options', async () => {
      const imageData = 'base64_image_data';
      const watermarkText = '© 2024';

      const result = await imageService.addWatermark(imageData, watermarkText);

      expect(result).toBe(`watermarked_${watermarkText}_bottom-right_0.5_${imageData}`);
    });

    it('should add watermark with custom options', async () => {
      const imageData = 'base64_image_data';
      const watermarkText = 'Confidential';
      const options = {
        position: 'top-left' as const,
        opacity: 0.8,
        fontSize: 20,
        color: '#ff0000'
      };

      const result = await imageService.addWatermark(imageData, watermarkText, options);

      expect(result).toBe(`watermarked_${watermarkText}_${options.position}_${options.opacity}_${imageData}`);
    });

    it('should handle different watermark positions', async () => {
      const imageData = 'base64_image_data';
      const watermarkText = 'Test';
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const;

      for (const position of positions) {
        const result = await imageService.addWatermark(imageData, watermarkText, { position });
        expect(result).toBe(`watermarked_${watermarkText}_${position}_0.5_${imageData}`);
      }
    });

    it('should handle special characters in watermark text', async () => {
      const imageData = 'base64_image_data';
      const watermarkText = '© ™ ® ★ ☆';

      const result = await imageService.addWatermark(imageData, watermarkText);
      expect(result).toBe(`watermarked_${watermarkText}_bottom-right_0.5_${imageData}`);
    });
  });

  describe('convertFormat', () => {
    it('should convert to JPEG', async () => {
      const imageData = 'base64_image_data';
      const format = 'jpeg' as const;

      const result = await imageService.convertFormat(imageData, format);

      expect(result).toBe(`converted_to_${format}_${imageData}`);
    });

    it('should convert to PNG', async () => {
      const imageData = 'base64_image_data';
      const format = 'png' as const;

      const result = await imageService.convertFormat(imageData, format);

      expect(result).toBe(`converted_to_${format}_${imageData}`);
    });

    it('should convert to WebP', async () => {
      const imageData = 'base64_image_data';
      const format = 'webp' as const;

      const result = await imageService.convertFormat(imageData, format);

      expect(result).toBe(`converted_to_${format}_${imageData}`);
    });
  });

  describe('getImageInfo', () => {
    it('should get image information successfully', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.getImageInfo(imageData);

      expect(result).toEqual({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: imageData.length,
        colorSpace: 'RGB',
        hasAlpha: false
      });
    });

    it('should return correct types', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.getImageInfo(imageData);

      expect(typeof result.width).toBe('number');
      expect(typeof result.height).toBe('number');
      expect(typeof result.format).toBe('string');
      expect(typeof result.size).toBe('number');
      expect(typeof result.colorSpace).toBe('string');
      expect(typeof result.hasAlpha).toBe('boolean');
    });

    it('should handle different image sizes', async () => {
      const smallImageData = 'small';
      const largeImageData = 'very_large_image_data_string';

      const smallResult = await imageService.getImageInfo(smallImageData);
      const largeResult = await imageService.getImageInfo(largeImageData);

      expect(smallResult.size).toBe(smallImageData.length);
      expect(largeResult.size).toBe(largeImageData.length);
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with default parameters', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.generateThumbnail(imageData);

      expect(result).toBe('thumbnail_150x150_q0.8_base64_image_data');
    });

    it('should generate thumbnail with custom size', async () => {
      const imageData = 'base64_image_data';
      const size = 200;

      const result = await imageService.generateThumbnail(imageData, size);

      expect(result).toBe(`thumbnail_${size}x${size}_q0.8_${imageData}`);
    });

    it('should generate thumbnail with custom quality', async () => {
      const imageData = 'base64_image_data';
      const quality = 0.9;

      const result = await imageService.generateThumbnail(imageData, 150, quality);

      expect(result).toBe(`thumbnail_150x150_q${quality}_${imageData}`);
    });

    it('should handle different thumbnail sizes', async () => {
      const imageData = 'base64_image_data';
      const sizes = [50, 100, 150, 200, 300];

      for (const size of sizes) {
        const result = await imageService.generateThumbnail(imageData, size);
        expect(result).toBe(`thumbnail_${size}x${size}_q0.8_${imageData}`);
      }
    });
  });

  describe('applyFilter', () => {
    it('should apply grayscale filter', async () => {
      const imageData = 'base64_image_data';
      const filterType = 'grayscale' as const;

      const result = await imageService.applyFilter(imageData, filterType);

      expect(result).toBe(`filtered_${filterType}_1_${imageData}`);
    });

    it('should apply filter with intensity', async () => {
      const imageData = 'base64_image_data';
      const filterType = 'blur' as const;
      const intensity = 0.5;

      const result = await imageService.applyFilter(imageData, filterType, intensity);

      expect(result).toBe(`filtered_${filterType}_${intensity}_${imageData}`);
    });

    it('should handle different filter types', async () => {
      const imageData = 'base64_image_data';
      const filterTypes = ['grayscale', 'sepia', 'blur', 'sharpen', 'brightness', 'contrast'] as const;

      for (const filterType of filterTypes) {
        const result = await imageService.applyFilter(imageData, filterType);
        expect(result).toBe(`filtered_${filterType}_1_${imageData}`);
      }
    });

    it('should handle different intensities', async () => {
      const imageData = 'base64_image_data';
      const filterType = 'brightness' as const;
      const intensities = [0.1, 0.5, 1.0, 1.5, 2.0];

      for (const intensity of intensities) {
        const result = await imageService.applyFilter(imageData, filterType, intensity);
        expect(result).toBe(`filtered_${filterType}_${intensity}_${imageData}`);
      }
    });
  });

  describe('adjustImageProperties', () => {
    it('should adjust brightness', async () => {
      const imageData = 'base64_image_data';
      const adjustments = { brightness: 1.2 };

      const result = await imageService.adjustImageProperties(imageData, adjustments);

      expect(result).toBe('adjusted_brightness_1.2_base64_image_data');
    });

    it('should adjust multiple properties', async () => {
      const imageData = 'base64_image_data';
      const adjustments = {
        brightness: 1.2,
        contrast: 1.1,
        saturation: 0.9,
        hue: 0.1
      };

      const result = await imageService.adjustImageProperties(imageData, adjustments);

      expect(result).toBe('adjusted_brightness_1.2_contrast_1.1_saturation_0.9_hue_0.1_base64_image_data');
    });

    it('should handle empty adjustments', async () => {
      const imageData = 'base64_image_data';
      const adjustments = {};

      const result = await imageService.adjustImageProperties(imageData, adjustments);

      expect(result).toBe('adjusted__base64_image_data');
    });

    it('should handle negative adjustments', async () => {
      const imageData = 'base64_image_data';
      const adjustments = { brightness: -0.5, contrast: -0.2 };

      const result = await imageService.adjustImageProperties(imageData, adjustments);

      expect(result).toBe('adjusted_brightness_-0.5_contrast_-0.2_base64_image_data');
    });
  });

  describe('removeBackground', () => {
    it('should remove background successfully', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.removeBackground(imageData);

      expect(result).toBe(`background_removed_${imageData}`);
    });

    it('should handle different image types', async () => {
      const imageDataTypes = [
        'jpeg_base64_data',
        'png_base64_data',
        'webp_base64_data'
      ];

      for (const imageData of imageDataTypes) {
        const result = await imageService.removeBackground(imageData);
        expect(result).toBe(`background_removed_${imageData}`);
      }
    });
  });

  describe('detectFaces', () => {
    it('should detect faces successfully', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.detectFaces(imageData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        x: 100,
        y: 100,
        width: 150,
        height: 150,
        confidence: 0.95
      });
      expect(result[1]).toEqual({
        x: 300,
        y: 200,
        width: 120,
        height: 120,
        confidence: 0.87
      });
    });

    it('should return face objects with correct structure', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.detectFaces(imageData);

      result.forEach(face => {
        expect(typeof face.x).toBe('number');
        expect(typeof face.y).toBe('number');
        expect(typeof face.width).toBe('number');
        expect(typeof face.height).toBe('number');
        expect(typeof face.confidence).toBe('number');
        expect(face.confidence).toBeGreaterThanOrEqual(0);
        expect(face.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('extractColors', () => {
    it('should extract colors successfully', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.extractColors(imageData);

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        hex: '#FF6B6B',
        rgb: { r: 255, g: 107, b: 107 },
        percentage: 35
      });
    });

    it('should extract custom number of colors', async () => {
      const imageData = 'base64_image_data';
      const count = 3;

      const result = await imageService.extractColors(imageData, count);

      expect(result).toHaveLength(count);
    });

    it('should return color objects with correct structure', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.extractColors(imageData);

      result.forEach(color => {
        expect(typeof color.hex).toBe('string');
        expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(typeof color.rgb).toBe('object');
        expect(typeof color.rgb.r).toBe('number');
        expect(typeof color.rgb.g).toBe('number');
        expect(typeof color.rgb.b).toBe('number');
        expect(typeof color.percentage).toBe('number');
        expect(color.percentage).toBeGreaterThanOrEqual(0);
        expect(color.percentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('optimizeForWeb', () => {
    it('should optimize image with default options', async () => {
      const imageData = 'base64_image_data';

      const result = await imageService.optimizeForWeb(imageData);

      expect(result.optimizedData).toBe('optimized_jpeg_0.8_base64_image_data');
      expect(result.originalSize).toBe(imageData.length);
      expect(result.optimizedSize).toBe(Math.floor(imageData.length * 0.8));
      expect(result.compressionRatio).toBe(1 / 0.8);
    });

    it('should optimize image with custom options', async () => {
      const imageData = 'base64_image_data';
      const options = {
        maxWidth: 1024,
        maxHeight: 768,
        quality: 0.6,
        format: 'webp' as const
      };

      const result = await imageService.optimizeForWeb(imageData, options);

      expect(result.optimizedData).toBe(`optimized_${options.format}_${options.quality}_${imageData}`);
      expect(result.optimizedSize).toBe(Math.floor(imageData.length * options.quality));
      expect(result.compressionRatio).toBe(1 / options.quality);
    });

    it('should return correct optimization metrics', async () => {
      const imageData = 'base64_image_data';
      const result = await imageService.optimizeForWeb(imageData);

      expect(typeof result.originalSize).toBe('number');
      expect(typeof result.optimizedSize).toBe('number');
      expect(typeof result.compressionRatio).toBe('number');
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.optimizedSize).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('createCollage', () => {
    it('should create collage with default options', async () => {
      const images = ['img1', 'img2', 'img3'];
      const layout = 'grid' as const;

      const result = await imageService.createCollage(images, layout);

      expect(result).toBe(`collage_${layout}_${images.length}_images_img1`);
    });

    it('should create collage with custom options', async () => {
      const images = ['img1', 'img2'];
      const layout = 'horizontal' as const;
      const options = {
        spacing: 20,
        backgroundColor: '#000000',
        borderRadius: 5
      };

      const result = await imageService.createCollage(images, layout, options);

      expect(result).toBe(`collage_${layout}_${images.length}_images_img1`);
    });

    it('should handle different layouts', async () => {
      const images = ['img1', 'img2'];
      const layouts = ['grid', 'horizontal', 'vertical', 'mosaic'] as const;

      for (const layout of layouts) {
        const result = await imageService.createCollage(images, layout);
        expect(result).toBe(`collage_${layout}_${images.length}_images_img1`);
      }
    });

    it('should handle empty images array', async () => {
      const images: string[] = [];
      const layout = 'grid' as const;

      const result = await imageService.createCollage(images, layout);

      expect(result).toBe('collage_grid_0_images_img1');
    });
  });

  describe('addFrame', () => {
    it('should add frame successfully', async () => {
      const imageData = 'base64_image_data';
      const frameOptions = {
        width: 10,
        color: '#000000',
        style: 'solid' as const
      };

      const result = await imageService.addFrame(imageData, frameOptions);

      expect(result).toBe(`framed_${frameOptions.width}px_${frameOptions.color}_${frameOptions.style}_${imageData}`);
    });

    it('should handle different frame styles', async () => {
      const imageData = 'base64_image_data';
      const styles = ['solid', 'dashed', 'double'] as const;

      for (const style of styles) {
        const frameOptions = { width: 5, color: '#ff0000', style };
        const result = await imageService.addFrame(imageData, frameOptions);
        expect(result).toBe(`framed_${frameOptions.width}px_${frameOptions.color}_${style}_${imageData}`);
      }
    });

    it('should handle different frame widths and colors', async () => {
      const imageData = 'base64_image_data';
      const testCases = [
        { width: 1, color: '#ff0000' },
        { width: 5, color: '#00ff00' },
        { width: 10, color: '#0000ff' },
        { width: 20, color: '#ffffff' }
      ];

      for (const frameOptions of testCases) {
        const options = { ...frameOptions, style: 'solid' as const };
        const result = await imageService.addFrame(imageData, options);
        expect(result).toBe(`framed_${frameOptions.width}px_${frameOptions.color}_solid_${imageData}`);
      }
    });
  });

  describe('error handling', () => {
    it('should handle empty image data', async () => {
      const emptyImageData = '';

      const resizeResult = await imageService.resizeImage(emptyImageData, 100, 100);
      expect(resizeResult).toBe('resized_100x100_');

      const compressResult = await imageService.compressImage(emptyImageData);
      expect(compressResult).toBe('compressed_0.8_');
    });

    it('should handle null/undefined image data', async () => {
      const nullImageData = null as any;
      const undefinedImageData = undefined as any;

      const resizeNullResult = await imageService.resizeImage(nullImageData, 100, 100);
      expect(resizeNullResult).toBe('resized_100x100_null');

      const compressUndefinedResult = await imageService.compressImage(undefinedImageData);
      expect(compressUndefinedResult).toBe('compressed_0.8_undefined');
    });

    it('should handle very large image data', async () => {
      const largeImageData = 'x'.repeat(1000000); // 1MB string

      const result = await imageService.resizeImage(largeImageData, 800, 600);
      expect(result).toBe('resized_800x600_x'.repeat(1000000));
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent image operations', async () => {
      const imageData = 'base64_image_data';
      const operations = Array.from({ length: 10 }, (_, i) => 
        imageService.resizeImage(imageData, 100 + i * 10, 100 + i * 10)
      );

      const results = await Promise.all(operations);

      results.forEach((result, index) => {
        const expectedSize = 100 + index * 10;
        expect(result).toBe(`resized_${expectedSize}x${expectedSize}_${imageData}`);
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const imageData = 'base64_image_data';
      const operations = [
        imageService.resizeImage(imageData, 800, 600),
        imageService.compressImage(imageData, 0.8),
        imageService.cropImage(imageData, 100, 100, 200, 200),
        imageService.rotateImage(imageData, 90),
        imageService.addWatermark(imageData, 'Test')
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toBe('resized_800x600_base64_image_data');
      expect(results[1]).toBe('compressed_0.8_base64_image_data');
      expect(results[2]).toBe('cropped_100_100_200_200_base64_image_data');
      expect(results[3]).toBe('rotated_90_base64_image_data');
      expect(results[4]).toBe('watermarked_Test_bottom-right_0.5_base64_image_data');
    });
  });

  describe('performance considerations', () => {
    it('should handle large numbers of image operations efficiently', async () => {
      const imageData = 'base64_image_data';
      const operations = Array.from({ length: 100 }, (_, i) => 
        imageService.resizeImage(imageData, 100, 100)
      );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(results.every(r => r.startsWith('resized_100x100_'))).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex image operations efficiently', async () => {
      const imageData = 'base64_image_data';
      
      const startTime = Date.now();
      const result = await imageService.optimizeForWeb(imageData, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        format: 'webp'
      });
      const endTime = Date.now();

      expect(result.optimizedData).toBe('optimized_webp_0.8_base64_image_data');
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete image processing workflow', async () => {
      const imageData = 'base64_image_data';
      
      // Step 1: Get image info
      const info = await imageService.getImageInfo(imageData);
      expect(info.width).toBe(1920);
      expect(info.height).toBe(1080);
      
      // Step 2: Resize for web
      const resized = await imageService.resizeImage(imageData, 800, 600);
      expect(resized).toBe('resized_800x600_base64_image_data');
      
      // Step 3: Compress
      const compressed = await imageService.compressImage(resized, 0.8);
      expect(compressed).toBe('compressed_0.8_resized_800x600_base64_image_data');
      
      // Step 4: Add watermark
      const watermarked = await imageService.addWatermark(compressed, '© 2024');
      expect(watermarked).toBe('watermarked_© 2024_bottom-right_0.5_compressed_0.8_resized_800x600_base64_image_data');
      
      // Step 5: Generate thumbnail
      const thumbnail = await imageService.generateThumbnail(watermarked, 150, 0.9);
      expect(thumbnail).toBe('thumbnail_150x150_q0.9_watermarked_© 2024_bottom-right_0.5_compressed_0.8_resized_800x600_base64_image_data');
    });

    it('should handle batch image processing', async () => {
      const images = ['image1', 'image2', 'image3'];
      
      // Process all images in parallel
      const processedImages = await Promise.all(
        images.map(async (image) => {
          const resized = await imageService.resizeImage(image, 400, 300);
          const compressed = await imageService.compressImage(resized, 0.7);
          const thumbnail = await imageService.generateThumbnail(compressed, 100);
          return thumbnail;
        })
      );
      
      expect(processedImages).toHaveLength(3);
      processedImages.forEach((result, index) => {
        expect(result).toBe(`thumbnail_100x100_q0.8_compressed_0.7_resized_400x300_${images[index]}`);
      });
    });

    it('should handle image analysis workflow', async () => {
      const imageData = 'base64_image_data';
      
      // Analyze image
      const info = await imageService.getImageInfo(imageData);
      const colors = await imageService.extractColors(imageData);
      const faces = await imageService.detectFaces(imageData);
      
      // Verify analysis results
      expect(info.width).toBe(1920);
      expect(colors).toHaveLength(5);
      expect(faces.length).toBeGreaterThan(0);
      
      // Process based on analysis
      if (faces.length > 0) {
        const cropped = await imageService.cropImage(
          imageData,
          faces[0].x,
          faces[0].y,
          faces[0].width,
          faces[0].height
        );
        expect(cropped).toBe('cropped_100_100_150_150_base64_image_data');
      }
    });
  });
});
