import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useQuery, useMutation, queryCache } from 'react-query';
import { useAuth0 } from '@auth0/auth0-react';

import { getData, postData } from '../../api/queries';
import TreeData from '../treedata/TreeData';
import AddTree from '../addtree/AddTree';
// import UserProfile from '../userprofile';
import config from '../../config';

mapboxgl.accessToken = config.mapbox.key;

function Mapper() {
  const componentName = 'Mapper';

  const { isAuthenticated, user } = useAuth0();
  const [mutateUser] = useMutation(postData, {
    onSuccess: () => {
      queryCache.invalidateQueries('user');
    },
  });

  // getData from DB
  const treemap = useQuery(['treemap', { city: 'Oakland' }], getData);
  const { data, error } = treemap || {};
  const mapData = data || null;

  const mapboxElRef = useRef(null); // DOM element to render map
  const [map, setMap] = useState(null);
  // const [zoom, setZoom] = useState(15);

  const [coordinatesNewTree, setCoordinatesNewTree] = useState(null);
  const [currentTreeId, setCurrentTreeId] = useState(null);
  const [currentTree, setCurrentTree] = useState({});
  const [showTree, setShowTree] = useState(false);
  const [zoomUserSet, setZoom] = useState(null);
  // -------------------------
  // Add search
  // -------------------------
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const resizeWindow = () => setWindowWidth(window.innerWidth);

  // Initialize our map
  useEffect(() => {
    if (isAuthenticated) mutateUser(['user', user]);
    if (!mapData) return;

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    });

    const map = new mapboxgl.Map({
      container: mapboxElRef.current,
      style: 'mapbox://styles/100ktrees/ckffjjvs41b3019ldl5tz9sps',
      center: coordinatesNewTree || [-122.196532, 37.779369],
      zoom: zoomUserSet || 15,
    });

    // Add the control to the map.
    map.addControl(geolocate);
    // Add navigation controls to the top right of the canvas
    map.addControl(new mapboxgl.NavigationControl());

    map.once('load', () => {
      // Add our DB SOURCE
      // if (!navigator.geolocation) {
      // geolocate.innerHTML = 'Geolocation is not available';
      // } else {
      // geolocate.trigger();
      // }
      map.addSource('treedata', {
        type: 'geojson',
        data: mapData,
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
      });

      // Add our layer
      if (mapData) {
        map.addLayer({
          id: 'treedata',
          source: 'treedata', // this should be the id of source
          type: 'circle',
          paint: {
            'circle-radius': {
              property: 'health',
              base: 1.75,
              stops: [
                [12, 2],
                [18, 280],
              ],
            },

            // "circle-color": "green",
            'circle-color': [
              'match',
              ['get', 'health'],
              'good', 'green',
              'fair', 'orange',
              'poor', 'red',
              'dead', 'black',
              'missing', 'darkgray',
              'stump', 'brown',
              /* other */ '#ccc',
            ],
          },
        });

        map.on('click', 'treedata', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          setCurrentTreeId(e.features[0].properties.id);
          setShowTree(true);
        });

        let hoveredStateId = null;
        if (windowWidth > 768) {
          // const popup = new mapboxgl.Popup({
          //   closeButton: false,
          //   closeOnClick: false,
          // });
          map.on('mousemove', 'treedata', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features.length > 0) {
              if (e.features[0].properties.id) {
                map.setFeatureState(
                  { source: 'treedata', id: hoveredStateId },
                  { hover: false },
                );
              }
              hoveredStateId = e.features[0].id;
              const { common } = e.features[0].properties;

              map.setFeatureState(
                { source: 'treedata', id: hoveredStateId },
                { hover: true },
              );
              map.getCanvas().style.cursor = 'pointer';
              const coordinates = e.features[0].geometry.coordinates.slice();

              const HTML = `<div><h1>${common}</h4><h4>lng: ${common} / lat: ${common}</h4></div>`;

              while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
              }

              popup.setLngLat(coordinates).setHTML(HTML).addTo(map);
            }
          });

          // When the mouse leaves the state-fill layer, update the feature state of the
          // previously hovered feature.
          map.on('mouseleave', 'treedata', () => {
            if (hoveredStateId) {
              map.setFeatureState(
                { source: 'treedata', id: hoveredStateId },
                { hover: false },
              );
            }
            hoveredStateId = null;
            // lastId = undefined;
            map.getCanvas().style.cursor = '';
            // popup.remove();
          });
        }
      }

      setMap(map);
    });
    // return () => {};
  }, [mapData]);

  // USER PROFILE
  // --------------------------
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const toggle = () => setModal(!userProfileOpen);
  if (error) return (<div>Failed to load trees</div>);
  return (
    <div className="App">
      <div className="map__container">
        {/* Mapbox container */}
        <div className="mapBox" ref={mapboxElRef} />
      </div>
      {userProfileOpen && (
        <UserProfile toggle={toggle} modal={userProfileOpen} />
      )}
      {currentTreeId && (
        <TreeData
          currentTreeId={currentTreeId}
          showTree={showTree}
          setShowTree={setShowTree}
        />
      )}
      {mapData && (
        <div className="addtreepage">
          <AddTree
            map={map}
            setZoom={setZoom}
            coordinatesNewTree={coordinatesNewTree}
            setCoordinatesNewTree={setCoordinatesNewTree}
          />
        </div>
      )}
    </div>
  );
}

export const serializeData = (data) => Object.entries(data)
  .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
  .join('&');

export default Mapper;
