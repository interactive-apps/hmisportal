import {Component, OnDestroy, OnInit} from '@angular/core';
import {Store} from '@ngrx/store';
import {ApplicationState} from '../store/application.state';
import {Observable} from 'rxjs/Observable';
import * as selectors from '../store/selectors';
import * as dataactions from '../store/actions/store.data.action';
import 'rxjs/add/operator/take';
import {PortalService} from '../shared/services/portal.service';
import {VisualizerService} from '../shared/services/visualizer.service';

import * as _ from 'lodash';
import {Subscription} from "rxjs/Subscription";
import {CHART_TYPES} from "../shared/chart_types";

@Component({
  moduleId: module.id,
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  years$: Observable<any[]>;
  organisationUnits$: Observable<any[]>;
  indicators: any = [];
  selected_ou: string;
  selected_ou_name: string;
  selected_pe: string;
  subscriptions: Subscription[] = [];
  geoFeatures: Array<any> = [];
  chartTypes = CHART_TYPES;

  constructor(private store: Store<ApplicationState>,
              private portalService: PortalService,
              private visualizer: VisualizerService) {
    this.store.dispatch(new dataactions.SetPageAction('dashboard'));
    this.years$ = this.store.select(selectors.getYears);
    this.organisationUnits$ = this.store.select(selectors.getOrganisationUnits);
    this.store.select(selectors.getSelectedOrgunit).take(1).subscribe(ou => this.selected_ou = ou);
    this.store.select(selectors.getDashboardPeriod).take(1).subscribe(pe => this.selected_pe = pe);
    this.store.select(selectors.getSelectedOrganisationUnit).subscribe(ou => this.selected_ou_name = ou.name);
  }

  ngOnInit() {
    this.updatePortal();
  }

  updatePortal() {
    this.store.select(selectors.getDashboardPeriod).take(1).subscribe((period) => {
      this.store.select(selectors.getSelectedOrganisationUnit).take(1).subscribe((orgunit) => {
        this.store.select(selectors.getPortalItems).take(1).subscribe(
          (data) => {

            this.portalService.getGeoFeatures('api/geoFeatures.json?ou=ou:' + this.portalService.getLevel(orgunit.level) + orgunit.id)
              .subscribe((geoFeatures) => {
                this.geoFeatures = geoFeatures;
                this.indicators.forEach((item) => {
                  if (item.visualizerType === 'map') {
                    item.loading = true;
                    let url = item.url;
                    url += '&dimension=ou:' + this.portalService.getLevel(orgunit.level) + orgunit.id + '&filter=pe:' + period;
                    this.portalService.getAnalyticsData(url).subscribe(
                      (analytics) => {
                        item.mapObject = this.visualizer.drawMap(analytics, this.geoFeatures);
                        item.loading = false;
                      });
                  }
                });
              });


            this.indicators = data;
            this.indicators.forEach((item) => {
              item.loading = true;
              if (item.hasOwnProperty('identifiers')) {
                item.identifiers = item.identifiers;
              } else {
                item.identifiers = _.map(item.data, (indicat: any) => indicat.uid).join(';');
              }
              item.showOptions = false;
              item.hasError = false;
              item.renderId = _.map(item.data, 'uid').join('_');
              const url = item.url + 'dimension=ou:' + this.portalService.getLevel(orgunit.level) + orgunit.id + '&filter=pe:' + period;
              // item.csv = url.replace('.json', '.csv');
              // item.csv = '../dhis/' + item.csv;
              this.subscriptions.push(
                this.portalService.getAnalyticsData(url).subscribe(
                  (analytics) => {
                    const chartConfiguration = {
                      type: item.chart,
                      title: item.title + ' - ' + orgunit.name + ' - ' + this.portalService.getPeriodName(period),
                      xAxisType: 'ou',
                      yAxisType: item.yAxisType,
                      show_labels: false
                    };
                    const tableConfiguration = {
                      title: item.title + ' - ' + orgunit.name + ' - ' + this.portalService.getPeriodName(period),
                      rows: ['ou'],
                      columns: ['dx'],
                      displayList: false,
                    };
                    item.visualizerType = (item.visualizerType) ? item.visualizerType : 'chart';
                    item.analytics = analytics;
                    item.chartObject = this.visualizer.drawChart(analytics, chartConfiguration);
                    item.tableObject = this.visualizer.drawTable(analytics, tableConfiguration);
                    item.csv = this.visualizer.prepareCSVData(analytics);
                    if (item.visualizerType === 'map') {
                      item.loading = true;
                    } else {
                      item.loading = false;
                    }

                  },
                  error => {
                    item.loading = false;
                    item.hasError = true;
                  }
                )
              );
              if (item.visualizerType === 'map') {
                item.loading = true;
              } else {
              }
            });
          }
        );
      });
    });
  }

  updateOrgunit(ou) {
    this.store.dispatch(new dataactions.SetSelectedOuAction(ou));
    this.updatePortal();
  }


  updatePeriod(pe) {
    this.store.dispatch(new dataactions.SetDashboardPerioAction(pe));
    this.updatePortal();
  }

  // Use this for all clean ups
  ngOnDestroy() {
    for (const subscr of this.subscriptions) {
      if (subscr) {
        subscr.unsubscribe();
      }
    }
  }
}
