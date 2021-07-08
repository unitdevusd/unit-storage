import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { IonSlides, IonSearchbar, ModalController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api-service.service';
import { GlobalService } from 'src/app/services/global.service';
import { LoaderService } from 'src/app/services/loader.service';
import { ToastService } from 'src/app/services/toast.service';
import { config , KEY, UNITURL} from '../../config/config';
import { Storage } from '@ionic/storage';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import {
  NativeGeocoder,
  NativeGeocoderResult,
  NativeGeocoderOptions
} from '@ionic-native/native-geocoder/ngx';
import { FiltersPage } from '../filters/filters.page';
import { Platform } from '@ionic/angular';

declare var google;

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page implements OnInit {
  
  @ViewChild(IonSlides) slides: IonSlides;
  @ViewChild('searchbar', { static: false }) searchbar: IonSearchbar;
  
  url: any = config.url;
  spaceType: any[];
  placesList: any = [];
  today: any = Date.now();
  filters: any = {};
  spaceFilters: any = [];
  autocomplete: { input: string; };
  autocompleteItems: any[];
  GoogleAutocomplete: any;
  lat: any;
  long: any;
  address: string;
  hasFilter: boolean = true;
  displayName: boolean;
  size: number = 10;
  sizeFilter : number = 2; 
  token: any;
  orgId: any;
  isEnd : boolean = true;
  isfirst : boolean = false;
  user : string = 'User';
  clearFilter: boolean = false;
  height: number;

  constructor(
    private router: Router,
    private _apiService: ApiService,
    private _loader: LoaderService,
    private _gs: GlobalService,
    private storage : Storage,
    private _toast: ToastService,
    private geolocation : Geolocation,
    private nativeGeocoder: NativeGeocoder,
    public zone: NgZone,
    public modalCtrl : ModalController,
    platform: Platform) {
      platform.ready().then(() => {
        console.log('Width: ' + platform.width());
        this.height = platform.height();
        console.log('Height: ' + platform.height());
      });
    
    // get current location
    setTimeout(() =>{ 
      this.getCurrentLocation();
    }, 1500);
    
    this.GoogleAutocomplete = new google.maps.places.AutocompleteService();
    this.autocomplete = { input: '' };
    this.autocompleteItems = [];

     // logout status
     this._gs.getLogOut().subscribe(status =>{
      if(status){
        this.placeMeta();
        this.displayName = true;
        this.getPlacesList(this.filters);
      }
    });
    
    this._gs.getData().subscribe(status =>{
      if(status){
        this.user = status.firstName +' '+ status.lastName;
      }
    });

    this._gs.getUpdatedTabs().subscribe(status => {
      if(status){
        this.token = status.token;
        this.orgId = status.orgId;
        this.displayName = true;
      }
    });
    this._gs.applyFilters().subscribe(filters =>{
      if(filters){
        console.log(filters);
        this.zone.run(()=>{
            this.filters = filters.refresh;
          this.getPlacesList(this.filters);
         this.displayName = true;
         this.clearFilter= false;
       });
      }
    });

    if(this.user == 'User'){
      this.storage.get('user').then((user) => {
        if (user) {
          this.user = user.firstName +''+ user.lastName;
        }
      });
    }
  }
  getCurrentLocation() {
    this.geolocation.getCurrentPosition().then((resp) => {
      this.lat = resp.coords.latitude;
      this.long = resp.coords.longitude;
      this.getAddressFromCoords(resp.coords.latitude, resp.coords.longitude);
    });
  }

  useCurrentLocation(){
    if(this.lat && this.long){
      this.filters['location'] = [this.lat,this.long];
    }
  }

  getAddressFromCoords(latitude: number, longitude: number) {
    console.log("getAddressFromCoords " + latitude + " " + longitude);
    if (latitude == undefined) {
      return;
    }
    let options: NativeGeocoderOptions = {
      useLocale: true,
      maxResults: 5
    };
    this.nativeGeocoder.reverseGeocode(latitude, longitude, options)
      .then((result: NativeGeocoderResult[]) => {
        this.address = "";
        let responseAddress = [];
        for (let [key, value] of Object.entries(result[0])) {
          if (value.length > 0)
            responseAddress.push(value);
        }
        responseAddress.reverse();
        for (let value of responseAddress) {
          this.address += value + ", ";
        }
        this.address = this.address.slice(0, -2);
      })
      .catch((error: any) => {
        this.address = "Address Not Available!";
      });
  }

  getPlacesList(filters: any) {
    this._loader.present();
    const params = {
      filters,
    };
    console.log(params);
    this._apiService.postRequest(this.url + UNITURL.spaces,
      params)
      .subscribe(
        async (result) => {
          console.log(result);
          if (result.success) {
            this._loader.dismiss();
            this.placesList = result.data.list;
            console.log(this.placesList);
          }else{
            this._loader.dismiss();
            console.log('err', result);
          }
        }
      ), (error) => {
        this._loader.dismiss();
        console.log('error', error)
      }
  }
  
  placeMeta() {
    const params = {
      apiKey: KEY.apikey
    };
    this._apiService.postRequest(this.url + UNITURL.placeMeta, params).subscribe(
      async (result) => {
        if (result.success) {
          console.log(result);
          this.spaceType = result.data.list.spaceType;
        } else {
          this._toast.presentToast(result.message);
        }
      });
  }

  ngOnInit() {
    this.placeMeta();
    this.setIcon();
    this.getPlacesList(this.filters);
  }

  setIcon() {
    if (Object.keys(this.filters).length === 0) {
      this.hasFilter = false;
      this.displayName = true;
      this.size = 10;
      this.sizeFilter = 2;
    } else {
      this.hasFilter = true;
      this.displayName = false;
      this.size = 9;
    }
  }


  searchLocation() {
    if (this.autocomplete.input == '') {
      this.autocompleteItems = [];
      return;
    }
    this.GoogleAutocomplete.getPlacePredictions({ input: this.autocomplete.input },
      (predictions, status) => {
        this.autocompleteItems = [];
        this.zone.run(() => {
          predictions.forEach((prediction) => {
            this.autocompleteItems.push(prediction);
          });
        });
      });
  }
  clearAutocomplete() {
    this.autocompleteItems = []
    this.autocomplete.input = '';
  }

  checkFocus() {
    console.log('focus');
  }
  async openFilter() {
    const modal = await this.modalCtrl.create({
      component: FiltersPage,
      cssClass: 'my-custom-modal-css',
      componentProps: {
        filters: JSON.stringify(this.filters)
      }
    });
    return await modal.present();
  }

  place(place) {
    console.log('@@', place);
    let navigationExtras: NavigationExtras = {
      queryParams: {
        special: JSON.stringify(place)
      }
    };
    console.log(navigationExtras);
    this.router.navigate(['place-detail'], navigationExtras);
  }


  spaceClick(item) {
    this.clearFilter = true;
    if (item.status) {
      item.status = false;
      const index: number = this.spaceFilters.indexOf(item._id);
      if (index !== -1) {
        this.spaceFilters.splice(index, 1);
      }
    } else {
      item.status = true;
      this.spaceFilters.push(item._id);
    };
    console.log(this.filters['spaceType']);
    if (this.filters['spaceType'] == undefined) {
      this.filters['spaceType'] = '';
    }
    this.filters['spaceType'] = this.spaceFilters ? this.spaceFilters : '';
    this.setIcon();
    this.getPlacesList(this.filters);
  }

  selectSearchResult(item) {
    this.address = item.structured_formatting.main_text;
    this.autocomplete.input = this.address;
    this.autocompleteItems = [];
    this.getLatLOng(item.description).then(location =>{
      this.filters['location'] = [location[0]['longitude'],location[0]['latitude']];
      console.log(this.filters);
      this.getPlacesList(this.filters);
    });
  }

  getLatLOng(addressString: any) : Promise<any> {
    console.log(addressString);
    let options: NativeGeocoderOptions = {
      useLocale: true,
      maxResults: 5,
    };
    console.log(options);
    return new Promise((resolve, reject) =>
    {
       this.nativeGeocoder.forwardGeocode(addressString)
       .then((result: NativeGeocoderResult[]) => 
       {
          console.log(result);
          resolve(result);
       })
       .catch((error: any) => 
       {
          reject(error);
       });
    });
  }

  slidePrev() {
    this.slides.slidePrev().then(x =>{
      console.log('x');
    })
  }
  slideNext() {
    this.slides.slideNext().then(X=>{
      console.log('X');
    })  
  }

  clearFilters(){
    this.zone.run(()=>{
       this.spaceType.map( x=> x.status = false);
       this.filters = {};
       this.getPlacesList(this.filters);
      this.displayName = true;
      this.clearFilter= false;
    });
  }

 
}
