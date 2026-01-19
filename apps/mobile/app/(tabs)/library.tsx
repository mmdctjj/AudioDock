import { AlphabetSidebar } from "@/src/components/AlphabetSidebar";
import { groupAndSort, SectionData } from "@/src/utils/pinyin";
import { Ionicons } from "@expo/vector-icons";
import { getArtistList, loadMoreAlbum } from "@soundx/services";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/context/ThemeContext";
import { getBaseURL } from "../../src/https";
import { Album, Artist } from "../../src/models";
import { usePlayMode } from "../../src/utils/playMode";

const GAP = 15;
const SCREEN_PADDING = 40; // 20 horizontal padding * 2
const TARGET_WIDTH = 100; // Slightly smaller target for dense list

// Helper to chunk data for grid layout
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const ArtistList = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode } = usePlayMode();
  const { width } = useWindowDimensions();
  const [sections, setSections] = useState<SectionData<Artist[]>[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionListRef = useRef<SectionList>(null);

  // Calculate columns dynamically
  const availableWidth = width - SCREEN_PADDING;
  const numColumns = Math.max(
    3, // Min 3 columns for better density
    Math.floor((availableWidth + GAP) / (TARGET_WIDTH + GAP)),
  );
  const itemWidth = (availableWidth - (numColumns - 1) * GAP) / numColumns;

  useEffect(() => {
    loadArtists();
  }, [mode]);

  const loadArtists = async () => {
    try {
      setLoading(true);
      // Fetch all artists (limit 1000)
      const res = await getArtistList(1000, 0, mode);

      if (res.code === 200 && res.data) {
        const { list } = res.data;
        const grouped = groupAndSort(list, (item) => item.name);

        // Chunk data for grid layout within sections
        const gridSections: any[] = grouped.map((section) => ({
          ...section,
          data: chunkArray(section.data, numColumns),
        }));

        setSections(gridSections);
      }
    } catch (error) {
      console.error("Failed to load artists:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrollToSection = (sectionIndex: number) => {
    if (sectionListRef.current && sections.length > 0) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: false, // Instant jump is better for drag
      });
    }
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={{ marginTop: 20 }}
      />
    );
  }

  return (
    <View style={styles.listContainer}>
      <SectionList
        ref={sectionListRef}
        sections={sections}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item, index) => `row-${index}`}
        renderSectionHeader={({ section: { title } }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.sectionHeaderText, { color: colors.primary }]}>
              {title}
            </Text>
          </View>
        )}
        renderItem={({ item: rowItems }) => (
          <View style={[styles.row, { gap: GAP }]}>
            {(rowItems as Artist[]).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{ width: itemWidth }}
                onPress={() => router.push(`/artist/${item.id}`)}
              >
                <Image
                  source={{
                    uri: item.avatar
                      ? `${getBaseURL()}${item.avatar}`
                      : `https://picsum.photos/seed/${item.id}/200/200`,
                  }}
                  style={[
                    styles.image,
                    {
                      width: itemWidth,
                      height: itemWidth,
                      backgroundColor: colors.card,
                    },
                  ]}
                />
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        onScrollToIndexFailed={() => {
          // Fallback if needed
        }}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        updateCellsBatchingPeriod={10}
        removeClippedSubviews={false} // Setting to false often fixes bounce in grid layouts
        stickySectionHeadersEnabled={false} // Sticky headers can cause jumpy behavior on some RN versions
      />
      <AlphabetSidebar
        sections={sections.map((s) => s.title)}
        onSelect={(section, index) => handleScrollToSection(index)}
      />
    </View>
  );
};

const AlbumList = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode } = usePlayMode();
  const { width } = useWindowDimensions();
  const [sections, setSections] = useState<SectionData<Album[]>[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionListRef = useRef<SectionList>(null);

  // Calculate columns dynamically
  const availableWidth = width - SCREEN_PADDING;
  const numColumns = Math.max(
    3,
    Math.floor((availableWidth + GAP) / (TARGET_WIDTH + GAP)),
  );
  const itemWidth = (availableWidth - (numColumns - 1) * GAP) / numColumns;

  useEffect(() => {
    loadAlbums();
  }, [mode]);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const res = await loadMoreAlbum({
        pageSize: 1000,
        loadCount: 0,
        type: mode,
      });

      if (res.code === 200 && res.data) {
        const { list } = res.data;
        const grouped = groupAndSort(list, (item) => item.name);

        // Chunk data for grid layout within sections
        const gridSections: any[] = grouped.map((section) => ({
          ...section,
          data: chunkArray(section.data, numColumns),
        }));

        setSections(gridSections);
      }
    } catch (error) {
      console.error("Failed to load albums:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrollToSection = (sectionIndex: number) => {
    if (sectionListRef.current && sections.length > 0) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: false,
      });
    }
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={{ marginTop: 20 }}
      />
    );
  }

  return (
    <View style={styles.listContainer}>
      <SectionList
        ref={sectionListRef}
        sections={sections}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item, index) => `row-${index}`}
        renderSectionHeader={({ section: { title } }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.sectionHeaderText, { color: colors.primary }]}>
              {title}
            </Text>
          </View>
        )}
        renderItem={({ item: rowItems }) => (
          <View style={[styles.row, { gap: GAP }]}>
            {(rowItems as Album[]).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{ width: itemWidth }}
                onPress={() => router.push(`/album/${item.id}`)}
              >
                <View
                  style={[
                    styles.albumImageContainer,
                    { width: itemWidth, height: itemWidth },
                  ]}
                >
                  <Image
                    source={{
                      uri: item.cover
                        ? `${getBaseURL()}${item.cover}`
                        : `https://picsum.photos/seed/${item.id}/200/200`,
                    }}
                    style={[
                      styles.albumImage,
                      {
                        width: itemWidth,
                        height: itemWidth,
                        backgroundColor: colors.card,
                      },
                    ]}
                  />
                  {(item.type === "AUDIOBOOK" || mode === "AUDIOBOOK") &&
                    (item as any).progress > 0 && (
                      <View style={styles.progressOverlay}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${item.progress || 0}%`,
                              backgroundColor: colors.primary,
                            },
                          ]}
                        />
                      </View>
                    )}
                </View>
                <Text
                  style={[styles.albumTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.albumArtist, { color: colors.secondary }]}
                  numberOfLines={1}
                >
                  {item.artist}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        onScrollToIndexFailed={() => {
          // Fallback if needed
        }}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        updateCellsBatchingPeriod={10}
        removeClippedSubviews={false}
        stickySectionHeadersEnabled={false}
      />
      <AlphabetSidebar
        sections={sections.map((s) => s.title)}
        onSelect={(section, index) => handleScrollToSection(index)}
      />
    </View>
  );
};

export default function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, setMode } = usePlayMode();
  const [activeTab, setActiveTab] = useState<"artists" | "albums">("artists");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>声仓</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push("/folder" as any)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.card, marginRight: 12 },
            ]}
          >
            <Ionicons name="folder-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/search")}
            style={[styles.iconButton, { backgroundColor: colors.card }]}
          >
            <Ionicons name="search" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode(mode === "MUSIC" ? "AUDIOBOOK" : "MUSIC")}
            style={[
              styles.iconButton,
              { backgroundColor: colors.card, marginLeft: 12 },
            ]}
          >
            <Ionicons
              name={mode === "MUSIC" ? "musical-notes" : "headset"}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContent}>
        <View
          style={[
            styles.segmentedControl,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentItem,
              activeTab === "artists" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setActiveTab("artists")}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === "artists"
                      ? colors.background
                      : colors.secondary,
                },
              ]}
            >
              艺术家
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentItem,
              activeTab === "albums" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setActiveTab("albums")}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === "albums"
                      ? colors.background
                      : colors.secondary,
                },
              ]}
            >
              专辑
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === "artists" ? <ArtistList /> : <AlbumList />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    flexDirection: "row",
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentedControl: {
    flexDirection: "row",
    height: 40,
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
  },
  segmentItem: {
    flex: 1,
    height: "100%",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingVertical: 10,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    marginBottom: 15,
  },
  // Removed fixed Width styles
  image: {
    borderRadius: 999, // circle
    marginBottom: 8,
    backgroundColor: "#f0f0f0",
    alignSelf: "center",
  },
  name: {
    fontSize: 14,
    textAlign: "center",
    color: "#333",
  },
  albumImageContainer: {
    borderRadius: 15,
    overflow: "hidden",
    position: "relative",
    marginBottom: 8,
  },
  albumImage: {
    backgroundColor: "#f0f0f0",
  },
  progressOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressBar: {
    height: "100%",
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  albumArtist: {
    fontSize: 12,
  },
});
